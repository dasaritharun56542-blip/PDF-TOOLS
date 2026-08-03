import os, io, uuid, threading
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse, FileResponse, HttpResponseNotFound, HttpResponseServerError
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from .models import UploadedFile, ProcessedFile, ToolUsageLog, DownloadHistory
from .utils import PDFProcessor

TOOLS = {
    'merge': {'name': 'Merge PDF', 'icon': 'bi-intersect', 'desc': 'Combine multiple PDFs into one document.', 'cat': 'edit'},
    'split': {'name': 'Split PDF', 'icon': 'bi-scissors', 'desc': 'Extract specific pages or ranges.', 'cat': 'edit'},
    'compress': {'name': 'Compress PDF', 'icon': 'bi-file-zip', 'desc': 'Optimize and reduce file size.', 'cat': 'optimize'},
    'pdf-to-word': {'name': 'PDF to Word', 'icon': 'bi-file-earmark-word', 'desc': 'Convert PDF to editable DOCX.', 'cat': 'convert_from', 'premium': True},
    'word-to-pdf': {'name': 'Word to PDF', 'icon': 'bi-file-earmark-word-fill', 'desc': 'Convert Word documents to PDF.', 'cat': 'convert_to', 'premium': True},
    'excel-to-pdf': {'name': 'Excel to PDF', 'icon': 'bi-file-earmark-excel-fill', 'desc': 'Transform Excel sheets to PDF.', 'cat': 'convert_to', 'premium': True},
    'pdf-to-pptx': {'name': 'PDF to PPT', 'icon': 'bi-file-earmark-slides', 'desc': 'Convert PDF to PowerPoint sets.', 'cat': 'convert_from', 'premium': True},
    'pptx-to-pdf': {'name': 'PPT to PDF', 'icon': 'bi-file-earmark-slides-fill', 'desc': 'Convert PPT slides to PDF.', 'cat': 'convert_to', 'premium': True},
    'pdf-to-jpg': {'name': 'PDF to JPG', 'icon': 'bi-file-earmark-image', 'desc': 'Extract all PDF pages as JPG.', 'cat': 'convert_from'},
    'image-to-pdf': {'name': 'Image to PDF', 'icon': 'bi-images', 'desc': 'Convert JPG, PNG, WEBP and more into PDF.', 'cat': 'convert_to'},
    'rotate': {'name': 'Rotate PDF', 'icon': 'bi-arrow-repeat', 'desc': 'Rotate pages 90, 180 or 270.', 'cat': 'edit'},
    'watermark': {'name': 'Add Watermark', 'icon': 'bi-patch-check', 'desc': 'Stamp an image or text on PDF.', 'cat': 'edit', 'premium': True},
    'page-numbers': {'name': 'Page Numbers', 'icon': 'bi-list-ol', 'desc': 'Add page numbers with style.', 'cat': 'edit'},
    'repair': {'name': 'Repair PDF', 'icon': 'bi-tools', 'desc': 'Fix damaged or corrupted PDFs.', 'cat': 'optimize'},
    'protect': {'name': 'Protect PDF', 'icon': 'bi-lock', 'desc': 'Encrypt your PDF with password.', 'cat': 'security'},
    'organize': {'name': 'Organize PDF', 'icon': 'bi-grid-3x3-gap', 'desc': 'Sort, add or delete PDF pages.', 'cat': 'edit', 'premium': True},
    'delete-pages': {'name': 'Delete Pages', 'icon': 'bi-trash', 'desc': 'Remove specific pages from PDF.', 'cat': 'edit'},
    'extract-pages': {'name': 'Extract Pages', 'icon': 'bi-box-arrow-up', 'desc': 'Get specific pages as new file.', 'cat': 'edit'},
    'sign-pdf': {'name': 'Sign PDF', 'icon': 'bi-pencil-fill', 'desc': 'Electronically sign your documents.', 'cat': 'security', 'premium': True},
    'edit-pdf': {'name': 'Edit PDF', 'icon': 'bi-pencil-square', 'desc': 'Add text, shapes, or images to your PDF.', 'cat': 'edit', 'premium': True},
}

CATEGORIES = {
    'all': 'All Tools',
    'edit': 'Edit PDF',
    'convert_to': 'Convert to PDF',
    'convert_from': 'Convert from PDF',
    'optimize': 'Optimize',
    'security': 'Security'
}

def home(request):
    dist_index = os.path.join(settings.BASE_DIR, 'dist', 'index.html')
    root_index = os.path.join(settings.BASE_DIR, 'index.html')
    target_html = dist_index if os.path.exists(dist_index) else root_index
    if os.path.exists(target_html):
        with open(target_html, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/html')
    return render(request, 'home.html', {'tools': TOOLS, 'categories': CATEGORIES})

def tool_detail(request, tool_slug):
    tool = TOOLS.get(tool_slug)
    if not tool: return redirect('home')
    if tool.get('premium'):
        if not request.user.is_authenticated:
            return redirect('login')
        
        from accounts.models import Profile
        profile, _ = Profile.objects.get_or_create(user=request.user)
        
        # Auto-grant trial if missing
        if not profile.trial_used:
            import datetime
            from django.utils import timezone
            profile.is_pro = True
            profile.pro_expiry = timezone.now() + datetime.timedelta(days=7)
            profile.trial_used = True
            profile.save()
            messages.info(request, "Welcome! You've been granted 7 days of FREE PRO access!")

        if not profile.is_pro_active:
            messages.warning(request, "This is a PRO tool. Please upgrade your plan to use it.")
            return redirect('pricing')
    
    print(f"DEBUG: Serving tool {tool_slug} with template {'edit_pdf.html' if tool_slug == 'edit-pdf' else 'tool.html'}")
    template = 'edit_pdf.html' if tool_slug == 'edit-pdf' else 'tool.html'
    return render(request, template, {'tool': tool, 'slug': tool_slug})

def get_page_count(request):
    if request.method == 'POST' and request.FILES.get('file'):
        f = request.FILES['file']
        try:
            from pypdf import PdfReader
            reader = PdfReader(f)
            return JsonResponse({'pages': len(reader.pages)})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Invalid request'}, status=400)

def tool_info(request, tool_slug):
    tool = TOOLS.get(tool_slug)
    if not tool: return JsonResponse({'error': 'Not found'}, status=404)
    return JsonResponse(tool)

def process_tool(request, tool_slug):
    if request.method == 'POST':
        files = request.FILES.getlist('files')
        
        if not files:
            return JsonResponse({'error': 'No files selected'}, status=400)

        # Enforce subscription limits
        is_premium = False
        is_trial = False
        is_free_forever = False
        
        if request.user.is_authenticated:
            from accounts.models import Profile
            import datetime
            from django.utils import timezone
            
            profile, _ = Profile.objects.using('default').get_or_create(user=request.user)
            from accounts.models import Subscription
            active_sub = Subscription.objects.using('default').filter(
                user=request.user,
                is_active=True,
                end_date__gt=timezone.now()
            ).order_by('-end_date').first()
            
            if active_sub and active_sub.plan is None:
                is_trial = True
            elif profile.is_pro_active:
                is_premium = True
            else:
                is_free_forever = True
        else:
            is_free_forever = True

        tool = TOOLS.get(tool_slug)
        if tool:
            if is_free_forever and tool.get('premium'):
                return JsonResponse({'error': 'Premium subscription required. Upgrade to unlock this tool.'}, status=403)
            
            if is_trial:
                from accounts.models import DailyUsage
                from django.utils import timezone
                try:
                    usage = DailyUsage.objects.using('default').get(user=request.user, date=timezone.now().date())
                    # 30 minutes daily limit
                    if usage.processing_time_seconds >= 1800:
                        return JsonResponse({'error': 'Daily limit reached. Upgrade to Premium.'}, status=403)
                except DailyUsage.DoesNotExist:
                    pass

        for f in files:
            file_ext = os.path.splitext(f.name)[1].lower()
            
            # Unified Validation Mapping
            EXT_MAP = {
                'pdf': ['.pdf'],
                'image': ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.gif', '.jfif'],
                'word': ['.docx', '.doc'],
                'excel': ['.xlsx', '.xls'],
                'ppt': ['.pptx', '.ppt'],
                'html': ['.html', '.htm']
            }
            
            if tool_slug in ['image-to-pdf', 'scan-to-pdf', 'ocr-image', 'resize-image', 'crop-image', 'compress-image', 'convert-image-format', 'remove-background']:
                allowed = EXT_MAP['image']
            elif tool_slug in ['merge', 'split', 'compress', 'pdf-to-word', 'pdf-to-pptx', 'pdf-to-jpg', 'rotate', 'watermark', 'page-numbers', 'repair', 'protect', 'organize', 'delete-pages', 'extract-pages', 'sign-pdf', 'edit-pdf', 'pdf-to-pdfa', 'ocr-pdf', 'redact-pdf', 'flatten-pdf', 'pdf-metadata-editor', 'compare-pdf']:
                allowed = EXT_MAP['pdf']
            elif tool_slug == 'word-to-pdf':
                allowed = EXT_MAP['word']
            elif tool_slug == 'excel-to-pdf':
                allowed = EXT_MAP['excel']
            elif tool_slug in ['pptx-to-pdf', 'powerpoint-to-pdf']:
                allowed = EXT_MAP['ppt']
            elif tool_slug in ['html-to-pdf', 'html-to-image']:
                allowed = EXT_MAP['html']
            else:
                allowed = []

            
            if f.size > settings.MAX_UPLOAD_SIZE:
                print(f" FILE SIZE ERROR: {f.name} ({f.size} bytes) exceeds max {settings.MAX_UPLOAD_SIZE} bytes.")
                return JsonResponse({'error': f'File {f.name} is too large (Max 50MB)'}, status=400)
                
            if allowed and file_ext not in allowed:
                print(f" TOOL MISMATCH: {tool_slug} rejected {f.name}")
                return JsonResponse({'error': f'Invalid format for this tool. Expected: {", ".join(allowed)}'}, status=400)
            
            # Global safety check
            global_allowed = ('.pdf', '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.gif', '.jfif', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.html', '.htm', '.odt', '.rtf')
            if file_ext not in global_allowed:
                return JsonResponse({'error': f'Unsupported file type: {file_ext}'}, status=400)

        
        # Save files using SecureStorageManager outside project workspace
        from .secure_storage import SecureStorageManager
        storage_mgr = SecureStorageManager()
        
        temp_paths = []
        uploaded_records = []
        for f in files:
            f.seek(0)
            meta = storage_mgr.store_file(f, f.name, category='uploaded')
            uf = UploadedFile(
                user_id=request.user.id if request.user.is_authenticated else None,
                file=meta['storage_path'],
                filename=f.name,
                stored_filename=meta['stored_filename'],
                storage_path=meta['storage_path'],
                checksum=meta['checksum'],
                file_type=meta['file_type'],
                size=meta['file_size']
            )
            uf.save()
            uploaded_records.append(uf)
            temp_paths.append(meta['absolute_path'])
        
        # Handle Logo if exists
        logo_path = None
        if request.FILES.get('logo'):
            logo = request.FILES['logo']
            logo_meta = storage_mgr.store_file(logo, logo.name, category='uploaded')
            logo_path = logo_meta['absolute_path']
        
        # Create processing record
        proc_file = ProcessedFile.objects.create(
            user_id=request.user.id if request.user.is_authenticated else None,
            original_file=uploaded_records[0] if uploaded_records else None,
            filename=files[0].name if files else "web_capture.pdf", 
            tool_used=tool_slug, 
            status='pending'
        )

        if not request.user.is_authenticated:
            guest_files = request.session.get('guest_files', [])
            guest_files.append(proc_file.id)
            request.session['guest_files'] = guest_files
            request.session.modified = True

        log_entry = ToolUsageLog.objects.create(
            user_id=request.user.id if request.user.is_authenticated else None, 
            tool_name=tool_slug
        )
        
        # Process immediately in a thread
        import threading
        import time
        def process_async():
            start_time = time.time()
            processor = PDFProcessor()
            opened_files = []
            try:
                proc_file.status = 'processing'
                proc_file.save()
                
                # Validate and open files for processing
                for path in temp_paths:
                    if not os.path.exists(path):
                        raise Exception(f"Temp file not found: {path}")
                    file_size = os.path.getsize(path)
                    if file_size == 0:
                        raise Exception(f"Temp file is empty: {path}")
                    
                    print(f"Opening file: {path} (size: {file_size} bytes)")
                    opened_files.append(open(path, 'rb'))
                
                # Process
                options = request.POST.dict()
                options['original_name'] = proc_file.filename # Carry original name
                if logo_path: options['logo_path'] = logo_path
                print(f"DEBUG process_async tool_slug={tool_slug}, options={options}", flush=True)
                processed_path, filename = processor.handle(tool_slug, opened_files, options)
                
                # Update record with complete secure metadata
                abs_proc_path = storage_mgr.get_absolute_path(processed_path)
                checksum = storage_mgr.calculate_checksum(abs_proc_path) if abs_proc_path.exists() else None
                file_size = abs_proc_path.stat().st_size if abs_proc_path.exists() else 0
                file_type = os.path.splitext(filename)[1].lstrip('.').lower() or 'pdf'

                proc_file.file = processed_path
                proc_file.stored_filename = os.path.basename(processed_path)
                proc_file.storage_path = processed_path
                proc_file.checksum = checksum
                proc_file.file_size = file_size
                proc_file.file_type = file_type
                proc_file.filename = filename
                proc_file.status = 'completed'
                proc_file.save()
                
            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()
                print(f"Processing error: {str(e)}")
                print(error_trace)
                proc_file.status = 'failed'
                proc_file.error_message = str(e)[:500]
                proc_file.save()
            finally:
                # Cleanup
                for f in opened_files:
                    try:
                        f.close()
                    except:
                        pass
                if logo_path:
                    try:
                        os.remove(logo_path)
                    except:
                        pass

                duration = int(time.time() - start_time)
                try:
                    log_entry.duration_seconds = duration
                    log_entry.status = 'success' if proc_file.status == 'completed' else 'failed'
                    log_entry.save()
                    
                    if request.user.is_authenticated:
                        from django.db.models import F
                        from accounts.models import DailyUsage
                        from django.utils import timezone
                        du, _ = DailyUsage.objects.using('default').get_or_create(
                            user=request.user,
                            date=timezone.now().date()
                        )
                        du.processing_time_seconds = F('processing_time_seconds') + duration
                        du.upload_count = F('upload_count') + len(temp_paths)
                        du.download_count = F('download_count') + 1
                        du.save()
                except Exception as e:
                    print(f"Error logging usage analytics: {e}")
        
        threading.Thread(target=process_async, daemon=True).start()
        return JsonResponse({'task_id': str(proc_file.task_id)}, status=202)
    
    return redirect('home')

def get_status(request, task_id):
    proc_file = get_object_or_404(ProcessedFile, task_id=task_id)
    
    # Secure ownership validation
    if proc_file.user_id:
        if not request.user.is_authenticated or request.user.id != proc_file.user_id:
            return JsonResponse({'error': 'Unauthorized access'}, status=403)
            
    data = {'status': proc_file.status, 'error': proc_file.error_message}
    if proc_file.status == 'completed':
        data['download_url'] = f'/download/{proc_file.id}/'
        data['filename'] = proc_file.filename
    return JsonResponse(data)

def download_file(request, file_id):
    file = get_object_or_404(ProcessedFile, id=file_id)
    
    # Secure ownership validation
    if file.user_id:
        if not request.user.is_authenticated or request.user.id != file.user_id:
            return HttpResponse("Unauthorized to download this file.", status=403)
    else:
        guest_files = request.session.get('guest_files', [])
        if guest_files and file.id not in guest_files:
            pass
            
    # Log download history
    try:
        DownloadHistory.objects.create(
            user=request.user if request.user.is_authenticated else None,
            processed_file=file
        )
    except Exception as e:
        print(f"Failed to log download history: {e}")
        
    from .secure_storage import SecureStorageManager
    storage_mgr = SecureStorageManager()
    rel_path = file.storage_path or (file.file.name if file.file else None)
    if not rel_path:
        return HttpResponseNotFound("File location not specified in secure storage.")
        
    try:
        abs_path = storage_mgr.get_absolute_path(rel_path)
        if not abs_path.exists():
            return HttpResponseNotFound("Requested file does not exist in secure storage.")
        return FileResponse(open(abs_path, 'rb'), as_attachment=True, filename=file.filename)
    except Exception as e:
        return HttpResponseServerError(f"Secure storage retrieval error: {str(e)}")

@login_required
def history(request):
    logs = ToolUsageLog.objects.filter(user_id=request.user.id).order_by('-timestamp')
    return render(request, 'history.html', {'logs': logs})

@login_required
def api_history_data(request):
    logs = ToolUsageLog.objects.filter(user_id=request.user.id).order_by('-timestamp')
    logs_list = []
    for log in logs:
        logs_list.append({
            'id': log.id,
            'tool_name': log.tool_name,
            'timestamp': log.timestamp.strftime('%Y-%m-%d %H:%M:%S') if log.timestamp else '',
            'status': log.status
        })
    return JsonResponse({'logs': logs_list})

@login_required
def dashboard(request):
    import datetime
    from django.utils import timezone
    
    from accounts.models import Profile
    profile, created = Profile.objects.get_or_create(user=request.user)
    if not profile.trial_used:
        profile.is_pro = True
        profile.pro_expiry = timezone.now() + datetime.timedelta(days=7)
        profile.trial_used = True
        profile.save()
        messages.info(request, "Welcome! You've been granted 7 days of FREE PRO access!")

    processed_files = ProcessedFile.objects.filter(user_id=request.user.id).order_by('-process_date')
    uploaded_files = UploadedFile.objects.filter(user_id=request.user.id).order_by('-upload_date')
    
    stats = {
        'total': ToolUsageLog.objects.filter(user_id=request.user.id).count(),
        'processed_files': processed_files,
        'uploaded_files': uploaded_files,
        'file_count': len(processed_files)
    }
    return render(request, 'dashboard.html', stats)

@login_required
def api_dashboard_data(request):
    from django.contrib.auth.models import User
    from accounts.models import Profile, Subscription, Payment, Invoice, DailyUsage
    from django.utils import timezone
    import datetime
    
    now = timezone.now()
    profile, _ = Profile.objects.using('default').get_or_create(user=request.user)
    
    from accounts.models import Subscription
    active_sub = Subscription.objects.using('default').filter(
        user=request.user,
        is_active=True,
        end_date__gt=now
    ).order_by('-end_date').first()
    
    is_premium = profile.is_pro_active
    days_left = profile.days_remaining
    
    trial_active = False
    trial_days_remaining = 0
    
    if is_premium:
        if active_sub and active_sub.plan is None:
            plan_name = "Free Trial"
            trial_active = True
            trial_days_remaining = days_left
        else:
            plan_name = active_sub.plan.name if (active_sub and active_sub.plan) else "Premium"
    else:
        plan_name = "Free Forever"
    
    today = now.date()
    usage, _ = DailyUsage.objects.using('default').get_or_create(user=request.user, date=today)
    today_duration_seconds = usage.processing_time_seconds
    today_remaining_seconds = max(0, 1800 - today_duration_seconds)
    
    processed_files = ProcessedFile.objects.filter(user_id=request.user.id).order_by('-process_date')
    uploaded_files = UploadedFile.objects.filter(user_id=request.user.id).order_by('-upload_date')
    
    processed_list = []
    for f in processed_files:
        processed_list.append({
            'id': f.id,
            'filename': f.filename,
            'tool_used': f.tool_used,
            'process_date': f.process_date.strftime('%Y-%m-%d %H:%M:%S') if f.process_date else '',
            'status': f.status,
            'error': f.error_message
        })
        
    uploaded_list = []
    for f in uploaded_files:
        uploaded_list.append({
            'id': f.id,
            'filename': f.filename,
            'upload_date': f.upload_date.strftime('%Y-%m-%d %H:%M:%S') if f.upload_date else '',
            'size': f.size
        })
        
    payments = Payment.objects.using('default').filter(user=request.user).order_by('-created_at')
    payments_list = []
    for p in payments:
        invoice_id = None
        invoice_num = None
        try:
            inv = p.invoice
            invoice_id = inv.id
            invoice_num = inv.invoice_number
        except Invoice.DoesNotExist:
            pass
            
        payments_list.append({
            'id': p.id,
            'order_id': p.order_id,
            'transaction_id': p.transaction_id,
            'amount': str(p.amount),
            'plan_name': p.plan.name if p.plan else 'Premium',
            'status': p.status,
            'created_at': p.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'invoice_id': invoice_id,
            'invoice_number': invoice_num
        })
        
    admin_stats = None
    if request.user.is_superuser or request.user.is_staff:
        total_users = User.objects.using('default').count()
        premium_users = Profile.objects.using('default').filter(is_pro=True, pro_expiry__gt=now).count()
        
        trial_cutoff = now - datetime.timedelta(days=7)
        trial_users = User.objects.using('default').filter(date_joined__gt=trial_cutoff).exclude(profile__is_pro=True, profile__pro_expiry__gt=now).count()
        
        from django.db.models import Sum
        revenue_sum = Payment.objects.using('default').filter(status='success').aggregate(Sum('amount'))['amount__sum'] or 0
        
        # Today's, Monthly, and Yearly revenue
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        
        revenue_today = Payment.objects.using('default').filter(status='success', created_at__gte=today_start).aggregate(Sum('amount'))['amount__sum'] or 0
        revenue_monthly = Payment.objects.using('default').filter(status='success', created_at__gte=month_start).aggregate(Sum('amount'))['amount__sum'] or 0
        revenue_yearly = Payment.objects.using('default').filter(status='success', created_at__gte=year_start).aggregate(Sum('amount'))['amount__sum'] or 0
        
        active_subs = Subscription.objects.using('default').filter(is_active=True, end_date__gt=now).count()
        expired_subs = Subscription.objects.using('default').filter(is_active=False).count()
        failed_payments = Payment.objects.using('default').filter(status='failed').count()
        refunds_count = Payment.objects.using('default').filter(status='refunded').count()
        
        # Simple count of renewals
        renewals_count = Subscription.objects.using('default').exclude(plan=None).count() - Subscription.objects.using('default').exclude(plan=None).values('user').distinct().count()
        renewals_count = max(0, renewals_count)
        
        # Top Customers
        top_customers_query = Payment.objects.using('default').filter(status='success').values('user__username', 'user__email').annotate(total_spent=Sum('amount')).order_by('-total_spent')[:10]
        top_customers = []
        for tc in top_customers_query:
            top_customers.append({
                'username': tc['user__username'],
                'email': tc['user__email'],
                'total_spent': str(tc['total_spent'])
            })
            
        recent_payments = Payment.objects.using('default').all().order_by('-created_at')[:20]
        recent_txns = []
        for rp in recent_payments:
            recent_txns.append({
                'username': rp.user.username,
                'amount': str(rp.amount),
                'plan_name': rp.plan.name if rp.plan else 'Premium',
                'status': rp.status,
                'created_at': rp.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
            
        from django.db.models import Count
        tool_counts = ToolUsageLog.objects.using('default').values('tool_name').annotate(count=Count('id')).order_by('-count')
        tool_analytics = {item['tool_name']: item['count'] for item in tool_counts}
        
        admin_stats = {
            'total_users': total_users,
            'premium_users': premium_users,
            'trial_users': trial_users,
            'revenue': str(revenue_sum),
            'revenue_today': str(revenue_today),
            'revenue_monthly': str(revenue_monthly),
            'revenue_yearly': str(revenue_yearly),
            'active_subscriptions': active_subs,
            'expired_subscriptions': expired_subs,
            'failed_payments': failed_payments,
            'refunds_count': refunds_count,
            'renewals_count': renewals_count,
            'top_customers': top_customers,
            'recent_transactions': recent_txns,
            'tool_analytics': tool_analytics
        }
        
    return JsonResponse({
        'total': ToolUsageLog.objects.filter(user_id=request.user.id).count(),
        'file_count': len(processed_files),
        'trial_used': profile.trial_used,
        'processed_files': processed_list,
        'uploaded_files': uploaded_list,
        'plan_name': plan_name,
        'is_premium': is_premium,
        'days_left': days_left,
        'trial_active': trial_active,
        'trial_days_remaining': trial_days_remaining,
        'today_duration_seconds': today_duration_seconds,
        'today_remaining_seconds': today_remaining_seconds,
        'today_remaining_minutes': round(today_remaining_seconds / 60.0, 1),
        'expiry_date': profile.pro_expiry.strftime('%Y-%m-%d %H:%M:%S') if profile.pro_expiry else None,
        'payments': payments_list,
        'admin_stats': admin_stats
    })

def error_404(request, exception): return render(request, '404.html', status=404)
def error_500(request): return render(request, '500.html', status=500)

@csrf_exempt
def api_preview_word(request):
    """API endpoint to generate high-resolution page previews for Word (.doc/.docx) documents."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    if not request.FILES.get('file'):
        return JsonResponse({'error': 'No file uploaded'}, status=400)

    uploaded_file = request.FILES['file']
    filename = uploaded_file.name

    try:
        from .utils import PDFProcessor
        processor = PDFProcessor()
        preview_data = processor.generate_word_preview_images(uploaded_file, filename)
        return JsonResponse(preview_data)
    except Exception as e:
        print(f"Word preview generation error: {e}")
        return JsonResponse({'error': f"Word document preview failed: {str(e)}"}, status=500)

@csrf_exempt
def api_office_engine_status(request):
    """API endpoint returning available Office-to-PDF conversion engine capabilities."""
    try:
        from .office_converter import OfficeToPdfConverter
        caps = OfficeToPdfConverter.detect_engine_capabilities()
        return JsonResponse({
            'success': True,
            'capabilities': caps
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

def admin_stealth_404(request, *args, **kwargs):
    """Stealth 404 handler for public /admin paths to conceal admin existence."""
    return HttpResponseNotFound("<h1>404 Not Found</h1><p>The requested URL was not found on this server.</p>", content_type="text/html")

def error_404(request, exception=None):
    return HttpResponseNotFound("<h1>404 Not Found</h1><p>The requested URL was not found on this server.</p>", content_type="text/html")

def error_500(request):
    return HttpResponseServerError("<h1>500 Internal Server Error</h1><p>An unexpected server error occurred.</p>", content_type="text/html")

# =====================================================================
# ENTERPRISE SECURE STORAGE ADMIN APIs
# =====================================================================

from django.core.paginator import Paginator

@login_required
def api_admin_storage_stats(request):
    if not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized: Admin access required'}, status=403)
    from .secure_storage import SecureStorageManager
    storage_mgr = SecureStorageManager()
    stats = storage_mgr.get_storage_stats()
    
    total_uploaded_db = UploadedFile.objects.count()
    total_processed_db = ProcessedFile.objects.count()
    completed_processed_db = ProcessedFile.objects.filter(status='completed').count()
    failed_processed_db = ProcessedFile.objects.filter(status='failed').count()
    
    stats.update({
        'total_uploaded_records': total_uploaded_db,
        'total_processed_records': total_processed_db,
        'completed_processed_records': completed_processed_db,
        'failed_processed_records': failed_processed_db,
    })
    return JsonResponse({'success': True, 'stats': stats})

@login_required
def api_admin_files_list(request):
    if not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized: Admin access required'}, status=403)
        
    category = request.GET.get('category', 'processed') # 'processed' or 'uploaded'
    page_number = request.GET.get('page', 1)
    page_size = int(request.GET.get('page_size', 20))
    search = request.GET.get('search', '').strip()
    status_filter = request.GET.get('status', '').strip()
    tool_filter = request.GET.get('tool', '').strip()
    sort_by = request.GET.get('sort_by', '-date')
    
    if category == 'uploaded':
        queryset = UploadedFile.objects.all()
        if search:
            queryset = queryset.filter(filename__icontains=search) | queryset.filter(stored_filename__icontains=search) | queryset.filter(checksum__icontains=search)
        if sort_by == 'date':
            queryset = queryset.order_by('upload_date')
        elif sort_by == '-date':
            queryset = queryset.order_by('-upload_date')
        elif sort_by == 'size':
            queryset = queryset.order_by('size')
        elif sort_by == '-size':
            queryset = queryset.order_by('-size')
            
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page_number)
        
        items = []
        for item in page_obj:
            items.append({
                'id': item.id,
                'file_id': item.id,
                'original_filename': item.filename,
                'stored_filename': item.stored_filename or (os.path.basename(item.file.name) if item.file else ''),
                'user_id': item.user_id,
                'user_email': item.user_email,
                'tool_used': 'upload',
                'upload_time': item.upload_date.strftime('%Y-%m-%d %H:%M:%S') if item.upload_date else '',
                'status': 'uploaded',
                'file_size': item.size,
                'file_type': item.file_type or os.path.splitext(item.filename)[1].lstrip('.'),
                'storage_path': item.storage_path or (item.file.name if item.file else ''),
                'checksum': item.checksum or ''
            })
    else:
        queryset = ProcessedFile.objects.all()
        if search:
            queryset = queryset.filter(filename__icontains=search) | queryset.filter(stored_filename__icontains=search) | queryset.filter(checksum__icontains=search)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if tool_filter:
            queryset = queryset.filter(tool_used=tool_filter)
            
        if sort_by == 'date':
            queryset = queryset.order_by('process_date')
        elif sort_by == '-date':
            queryset = queryset.order_by('-process_date')
        elif sort_by == 'size':
            queryset = queryset.order_by('file_size')
        elif sort_by == '-size':
            queryset = queryset.order_by('-file_size')
            
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page_number)
        
        items = []
        for item in page_obj:
            items.append({
                'id': item.id,
                'file_id': item.id,
                'original_filename': item.filename,
                'stored_filename': item.stored_filename or (os.path.basename(item.file.name) if item.file else ''),
                'user_id': item.user_id,
                'user_email': item.user_email,
                'tool_used': item.tool_used,
                'processing_time': item.process_date.strftime('%Y-%m-%d %H:%M:%S') if item.process_date else '',
                'status': item.status,
                'file_size': item.file_size,
                'file_type': item.file_type or os.path.splitext(item.filename)[1].lstrip('.'),
                'storage_path': item.storage_path or (item.file.name if item.file else ''),
                'checksum': item.checksum or '',
                'error_message': item.error_message
            })
            
    return JsonResponse({
        'success': True,
        'category': category,
        'page': page_obj.number,
        'total_pages': paginator.num_pages,
        'total_count': paginator.count,
        'items': items
    })

@login_required
def api_admin_file_preview(request, category, file_id):
    if not (request.user.is_superuser or request.user.is_staff):
        return HttpResponse("Unauthorized", status=403)
    from .secure_storage import SecureStorageManager
    storage_mgr = SecureStorageManager()
    
    if category == 'uploaded':
        record = get_object_or_404(UploadedFile, id=file_id)
        rel_path = record.storage_path or record.file.name
        filename = record.filename
    else:
        record = get_object_or_404(ProcessedFile, id=file_id)
        rel_path = record.storage_path or record.file.name
        filename = record.filename
        
    try:
        abs_path = storage_mgr.get_absolute_path(rel_path)
        if not abs_path.exists():
            return HttpResponseNotFound("File not found in storage")
        return FileResponse(open(abs_path, 'rb'), filename=filename)
    except Exception as e:
        return HttpResponseServerError(str(e))

@login_required
@csrf_exempt
def api_admin_file_delete(request):
    if not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    import json
    try:
        data = json.loads(request.body)
        category = data.get('category', 'processed')
        file_ids = data.get('file_ids', [])
        if not file_ids:
            return JsonResponse({'error': 'No file IDs provided'}, status=400)
            
        from .secure_storage import SecureStorageManager
        storage_mgr = SecureStorageManager()
        deleted_count = 0
        
        if category == 'uploaded':
            records = UploadedFile.objects.filter(id__in=file_ids)
            for rec in records:
                rel_path = rec.storage_path or rec.file.name
                storage_mgr.delete_file(rel_path)
                rec.delete()
                deleted_count += 1
        else:
            records = ProcessedFile.objects.filter(id__in=file_ids)
            for rec in records:
                rel_path = rec.storage_path or rec.file.name
                storage_mgr.delete_file(rel_path)
                rec.delete()
                deleted_count += 1
                
        return JsonResponse({'success': True, 'deleted_count': deleted_count})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)