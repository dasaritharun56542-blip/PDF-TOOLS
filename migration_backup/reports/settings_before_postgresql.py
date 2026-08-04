import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(os.path.join(BASE_DIR, '.env'), override=True)

SECRET_KEY = 'django-insecure-@8n#k*9!p+z^5_x=l-r%s+v*6&y#w@m!q$j^u*i&t#o' # RELOAD V5.1

DEBUG = True

ALLOWED_HOSTS = ['*']

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
    'documents',
    
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

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'pdf_powerhouse'),
        'USER': os.environ.get('DB_USER', 'pdf_powerhouse'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'pdf_powerhouse_pass_2026'),
        'HOST': os.environ.get('DB_HOST', '127.0.0.1'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    },
    'media_db': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('MEDIA_DB_NAME', 'pdf_powerhouse_media'),
        'USER': os.environ.get('DB_USER', 'pdf_powerhouse'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'pdf_powerhouse_pass_2026'),
        'HOST': os.environ.get('DB_HOST', '127.0.0.1'),
        'PORT': os.environ.get('DB_PORT', '5432'),
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
SOCIALACCOUNT_ADAPTER = 'accounts.adapters.CustomSocialAccountAdapter'

# Provider Configuration
SOCIALACCOUNT_PROVIDERS = {
    'google': {
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
ACCOUNT_LOGOUT_REDIRECT_URL = 'home'
ACCOUNT_LOGIN_METHODS = {'email'}
ACCOUNT_SIGNUP_FIELDS = ['email*', 'password1*', 'password2*']
ACCOUNT_EMAIL_VERIFICATION = 'optional'

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
]
CORS_ALLOW_CREDENTIALS = True

# PhonePe Configuration
PHONEPE_MERCHANT_ID = os.getenv('PHONEPE_MERCHANT_ID', 'PGTESTPAYUAT86').strip()
PHONEPE_SALT_KEY = os.getenv('PHONEPE_SALT_KEY', '96434309-7759-4ad3-87bd-5f50f6817b3f').strip()
PHONEPE_SALT_INDEX = int(os.getenv('PHONEPE_SALT_INDEX', '1').strip())
PHONEPE_ENV = os.getenv('PHONEPE_ENV', 'UAT').strip() # 'UAT' or 'PROD'
PHONEPE_REDIRECT_URL = os.getenv('PHONEPE_REDIRECT_URL', 'http://localhost:5174/accounts/payment-success').strip()
PHONEPE_CALLBACK_URL = os.getenv('PHONEPE_CALLBACK_URL', 'http://localhost:8000/accounts/phonepe/webhook/').strip()

# ONLYOFFICE Document Server Conversion Service Settings
ONLYOFFICE_URL = os.getenv('ONLYOFFICE_URL', 'http://localhost:8080').strip()
ONLYOFFICE_TIMEOUT = int(os.getenv('ONLYOFFICE_TIMEOUT', '60'))
ONLYOFFICE_MAX_RETRIES = int(os.getenv('ONLYOFFICE_MAX_RETRIES', '3'))

# Celery Configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'

# Gotenberg Engine Endpoint Configuration
GOTENBERG_URL = os.getenv('GOTENBERG_URL', 'http://gotenberg:3000/forms/libreoffice/convert')
CORS_ALLOW_ALL_ORIGINS = True