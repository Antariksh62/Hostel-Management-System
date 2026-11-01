const fs = require('fs');
const path = require('path');

const loginPath = path.join(__dirname, '../frontend-react/src/pages/Login.jsx');
let code = fs.readFileSync(loginPath, 'utf8');

// 1. Add imports if not present
if (!code.includes('useTranslation')) {
  code = code.replace(
    'import React, { useState, useContext, useRef, useEffect } from "react";',
    'import React, { useState, useContext, useRef, useEffect } from "react";\nimport { useTranslation } from "react-i18next";\nimport LanguageSwitcher from "@/components/common/LanguageSwitcher";'
  );
}

// 2. Add hook at top of component
if (!code.includes('const { t } = useTranslation();')) {
  code = code.replace(
    'const navigate = useNavigate();',
    'const navigate = useNavigate();\n  const { t } = useTranslation();'
  );
}

// 3. Update header with LanguageSwitcher
code = code.replace(
  '<ThemeButton />',
  '<div className="flex items-center gap-2">\n          <LanguageSwitcher />\n          <ThemeButton />\n        </div>'
);

// 4. Update title and subtitle
code = code.replace(
  '<h1 className="text-2xl font-bold tracking-tight">Sign in</h1>',
  '<h1 className="text-2xl font-bold tracking-tight">{t("common.sign_in", "Sign in")}</h1>'
);
code = code.replace(
  '<p className="mt-1 text-sm text-muted-foreground">\n            Choose your role to access your hostel services.\n          </p>',
  '<p className="mt-1 text-sm text-muted-foreground">\n            {t("auth.student_otp_note", "Choose your role to access your hostel services.")}\n          </p>'
);

// 5. Update tabs
code = code.replace('<TabsTrigger value="student">Student</TabsTrigger>', '<TabsTrigger value="student">{t("auth.student_tab", "Student")}</TabsTrigger>');
code = code.replace('<TabsTrigger value="staff">Staff</TabsTrigger>', '<TabsTrigger value="staff">{t("nav.staff", "Staff")}</TabsTrigger>');
code = code.replace('<TabsTrigger value="warden">Warden</TabsTrigger>', '<TabsTrigger value="warden">{t("common.hostel_administration", "Warden")}</TabsTrigger>');
code = code.replace('<TabsTrigger value="incharge">Incharge</TabsTrigger>', '<TabsTrigger value="incharge">{t("common.operations_intelligence", "Incharge")}</TabsTrigger>');

// 6. Update labels
code = code.replace(
  '{role === "student" ? "College email" : "Work email"}',
  '{role === "student" ? t("auth.email_label", "College email") : t("auth.admin_email_label", "Work email")}'
);

// 7. Update submit button
code = code.replace(
  '{role === "student" ? "Send verification code" : "Continue"}',
  '{role === "student" ? t("auth.send_otp_btn", "Send OTP") : t("common.proceed", "Continue")}'
);

// 8. Update OTP step
code = code.replace(
  '<Label htmlFor="otp">Enter the 6-digit code</Label>',
  '<Label htmlFor="otp">{t("auth.otp_label", "Enter 6-Digit OTP")}</Label>'
);
code = code.replace(
  'Verify & Sign in',
  '{t("auth.verify_otp_btn", "Verify OTP & Continue")}'
);

// 9. Update Password step
code = code.replace(
  '<Label htmlFor="password">Password</Label>',
  '<Label htmlFor="password">{t("auth.password_label", "Password")}</Label>'
);
code = code.replace(
  'Sign in\n                </Button>',
  '{t("common.sign_in", "Sign in")}\n                </Button>'
);

// 10. Update BackLink
code = code.replace(
  'Back\n    </button>',
  '{t("common.back", "Back")}\n    </button>'
);

fs.writeFileSync(loginPath, code, 'utf8');
console.log('✅ Login.jsx updated with multilingual support and LanguageSwitcher!');

