const fs = require('fs');
const path = require('path');

const shellPath = path.join(__dirname, '../frontend-react/src/components/hoidss/shell.tsx');
let code = fs.readFileSync(shellPath, 'utf8');

// Add import
if (!code.includes('LanguageSwitcher')) {
  code = code.replace(
    'import AdminNotificationBell from "@/components/notifications/AdminNotificationBell";',
    'import AdminNotificationBell from "@/components/notifications/AdminNotificationBell";\nimport LanguageSwitcher from "@/components/common/LanguageSwitcher";'
  );
}

// Add to desktop TopBar
if (!code.includes('<LanguageSwitcher />')) {
  code = code.replace(
    '<AdminNotificationBell />',
    '<LanguageSwitcher />\n            <AdminNotificationBell />'
  );

  // Add to mobile drawer
  code = code.replace(
    '<a\n              href="/"\n              onClick={() => {',
    '<div className="flex items-center justify-between px-2 py-2 mb-2 text-xs text-muted-foreground">\n              <span>Language / भाषा</span>\n              <LanguageSwitcher />\n            </div>\n            <a\n              href="/"\n              onClick={() => {'
  );
}

fs.writeFileSync(shellPath, code, 'utf8');
console.log('✅ components/hoidss/shell.tsx successfully updated with LanguageSwitcher!');

