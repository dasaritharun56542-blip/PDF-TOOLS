import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(os.path.join(BASE_DIR, '.env'), override=True)

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-@8n#k*9!p+z^5_x=l-r%s+v*6&y#w@m!q$j^u*i&t#o')

DEBUG = os.getenv('DJANGO_DEBUG', 'True').lower() in ('true', '1', 't')

raw_allowed_hosts = os.getenv('ALLOWED_HOSTS', '*')
ALLOWED_HOSTS = [h.strip() for h in raw_allowed_hosts.split(',') if h.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'corsheaders',
    'rest_framework',
    'core',
    'accounts',
    
    # Allauth
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'allauth.socialaccount.providers.facebook',
    'allauth.socialaccount.providers.github',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'accounts.middleware.HeaderSessionAuthMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'core.context_processors.tools_processor',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

db_url = os.environ.get('DATABASE_URL')
if db_url:
    from urllib.parse import urlparse
    parsed_db = urlparse(db_url)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql' if 'postgres' in parsed_db.scheme else 'django.db.backends.sqlite3',
            'NAME': parsed_db.path.lstrip('/') or 'pdf_powerhouse',
            'USER': parsed_db.username or '',
            'PASSWORD': parsed_db.password or '',
            'HOST': parsed_db.hostname or 'localhost',
            'PORT': str(parsed_db.port or 5432),
        },
        'media_db': {
            'ENGINE': 'django.db.backends.postgresql' if 'postgres' in parsed_db.scheme else 'django.db.backends.sqlite3',
            'NAME': os.environ.get('MEDIA_DB_NAME', (parsed_db.path.lstrip('/') or 'pdf_powerhouse') + '_media'),
            'USER': parsed_db.username or '',
            'PASSWORD': parsed_db.password or '',
            'HOST': parsed_db.hostname or 'localhost',
            'PORT': str(parsed_db.port or 5432),
        }
    }
elif os.environ.get('DB_HOST'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME', 'pdf_powerhouse'),
            'USER': os.environ.get('DB_USER', 'pdf_powerhouse'),
            'PASSWORD': os.environ.get('DB_PASSWORD', 'pdf_powerhouse_pass_2026'),
            'HOST': os.environ.get('DB_HOST'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        },
        'media_db': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('MEDIA_DB_NAME', 'pdf_powerhouse_media'),
            'USER': os.environ.get('DB_USER', 'pdf_powerhouse'),
            'PASSWORD': os.environ.get('DB_PASSWORD', 'pdf_powerhouse_pass_2026'),
            'HOST': os.environ.get('DB_HOST'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        },
        'media_db': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'media_db.sqlite3',
        }
    }

DATABASE_ROUTERS = ['core.db_routers.MediaRouter']


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']
if (BASE_DIR / 'dist').exists():
    STATICFILES_DIRS.append(BASE_DIR / 'dist')

MEDIA_URL = '/media/'
SECURE_ADMIN_STORAGE_DIR = Path(os.getenv('SECURE_ADMIN_STORAGE_DIR', Path.home() / '.secure_admin_storage'))
MEDIA_ROOT = SECURE_ADMIN_STORAGE_DIR

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# PDF processing limits
MAX_UPLOAD_SIZE = 52428800  # 50MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 52428800
FILE_UPLOAD_MAX_MEMORY_SIZE = 52428800

EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '').strip().replace(' ', '').replace('"', '').replace("'", "")
if EMAIL_HOST_PASSWORD == 'your_gmail_app_password_here' or not EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 465
EMAIL_USE_SSL = True
EMAIL_USE_TLS = False
EMAIL_TIMEOUT = 30

EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '').strip().replace('"', '').replace("'", "")
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER).strip().replace('"', '').replace("'", "")

# Stripe Configuration
STRIPE_PUBLISHABLE_KEY = os.getenv('STRIPE_PUBLISHABLE_KEY', 'pk_test_your_publishable_key')
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', 'sk_test_your_secret_key')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')
STRIPE_PRICE_ID = os.getenv('STRIPE_PRICE_ID', 'price_your_pro_price_id')


# Allauth Configuration
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

SITE_ID = 1
SOCIALACCOUNT_LOGIN_ON_GET = True
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_EMAIL_VERIFICATION = 'none'
SOCIALACCOUNT_EMAIL_REQUIRED = False
SOCIALACCOUNT_ADAPTER = 'accounts.adapters.CustomSocialAccountAdapter'

# Provider Configuration
SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'APP': {
            'client_id': os.getenv('GOOGLE_CLIENT_ID', '').strip(),
            'secret': os.getenv('GOOGLE_CLIENT_SECRET', '').strip(),
            'key': ''
        },
        'SCOPE': [
            'profile',
            'email',
        ],
        'AUTH_PARAMS': {
            'access_type': 'online',
        }
    },
    'facebook': {
        'METHOD': 'oauth2',
        'SCOPE': ['email', 'public_profile'],
        'AUTH_PARAMS': {'auth_type': 'reauthenticate'},
        'INIT_PARAMS': {'cookie': True},
        'FIELDS': [
            'id',
            'first_name',
            'last_name',
            'middle_name',
            'name',
            'name_format',
            'picture',
            'short_name'
        ],
        'EXCHANGE_TOKEN': True,
    },
    'github': {
        'SCOPE': [
            'user',
            'repo',
            'read:org',
        ],
    }
}

# Redirects
LOGIN_REDIRECT_URL = '/dashboard'
ACCOUNT_LOGOUT_REDIRECT_URL = '/'
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_EMAIL_VERIFICATION = 'none'

# Production Frontend & Domain Configuration
FRONTEND_URL = os.getenv('FRONTEND_URL', '').strip()

DEFAULT_CSRF_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
]
env_csrf_origins = os.getenv('CSRF_TRUSTED_ORIGINS', '')
if env_csrf_origins:
    DEFAULT_CSRF_ORIGINS.extend([o.strip() for o in env_csrf_origins.split(',') if o.strip()])
if FRONTEND_URL and FRONTEND_URL not in DEFAULT_CSRF_ORIGINS:
    DEFAULT_CSRF_ORIGINS.append(FRONTEND_URL)

CSRF_TRUSTED_ORIGINS = list(set(DEFAULT_CSRF_ORIGINS))
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = True

# Production HTTPS & Cross-Site Cookie Security Settings
if not DEBUG:
    SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'True').lower() in ('true', '1', 't')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = 'None'
    CSRF_COOKIE_SAMESITE = 'None'
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# PhonePe Configuration
PHONEPE_MERCHANT_ID = os.getenv('PHONEPE_MERCHANT_ID', 'PGTESTPAYUAT86').strip()
PHONEPE_SALT_KEY = os.getenv('PHONEPE_SALT_KEY', '96434309-7759-4ad3-87bd-5f50f6817b3f').strip()
PHONEPE_SALT_INDEX = int(os.getenv('PHONEPE_SALT_INDEX', '1').strip())
PHONEPE_ENV = os.getenv('PHONEPE_ENV', 'UAT').strip() # 'UAT' or 'PROD'
PHONEPE_REDIRECT_URL = os.getenv('PHONEPE_REDIRECT_URL', 'http://localhost:5174/accounts/payment-success').strip()
PHONEPE_CALLBACK_URL = os.getenv('PHONEPE_CALLBACK_URL', 'http://localhost:8000/accounts/phonepe/webhook/').strip()

# Celery Configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'