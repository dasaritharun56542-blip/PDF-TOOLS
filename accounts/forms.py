from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm

class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(required=True)
    
    class Meta(UserCreationForm.Meta):
        fields = UserCreationForm.Meta.fields + ('email',)
        
    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"]
        user.is_active = False # Require OTP verification
        if commit:
            user.save()
        return user

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs.update({'class': 'cyber-input'})

from django.contrib.auth import get_user_model

class CustomAuthenticationForm(AuthenticationForm):
    def clean(self):
        username = self.cleaned_data.get("username")
        password = self.cleaned_data.get("password")

        if username and password:
            UserModel = get_user_model()
            # Support both username and email authentication
            try:
                if '@' in username:
                    user = UserModel.objects.using('default').get(email=username)
                else:
                    user = UserModel.objects.using('default').get(username=username)
            except UserModel.DoesNotExist:
                raise self.get_invalid_login_error()

            if user.check_password(password):
                self.user_cache = user
            else:
                raise self.get_invalid_login_error()

            self.confirm_login_allowed(self.user_cache)

        return self.cleaned_data

    def confirm_login_allowed(self, user):
        # Allow inactive users to authenticate so they can complete the OTP verification flow
        pass

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs.update({'class': 'cyber-input'})
