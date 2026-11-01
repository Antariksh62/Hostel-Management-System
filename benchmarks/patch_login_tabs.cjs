const fs = require('fs');
const path = require('path');

// 1. Update locales
const enPath = path.join(__dirname, '../frontend-react/src/locales/en/translation.json');
const hiPath = path.join(__dirname, '../frontend-react/src/locales/hi/translation.json');
const mrPath = path.join(__dirname, '../frontend-react/src/locales/mr/translation.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const hi = JSON.parse(fs.readFileSync(hiPath, 'utf8'));
const mr = JSON.parse(fs.readFileSync(mrPath, 'utf8'));

en.auth.student_tab = "Student";
en.auth.staff_tab = "Staff";
en.auth.warden_tab = "Warden";
en.auth.incharge_tab = "Incharge";

hi.auth.student_tab = "छात्र";
hi.auth.staff_tab = "कर्मचारी";
hi.auth.warden_tab = "वार्डन";
hi.auth.incharge_tab = "प्रभारी";

mr.auth.student_tab = "विद्यार्थी";
mr.auth.staff_tab = "कर्मचारी";
mr.auth.warden_tab = "वॉर्डन";
mr.auth.incharge_tab = "प्रभारी";

fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
fs.writeFileSync(hiPath, JSON.stringify(hi, null, 2) + '\n', 'utf8');
fs.writeFileSync(mrPath, JSON.stringify(mr, null, 2) + '\n', 'utf8');
console.log('✅ Updated translation dictionaries with student_tab, staff_tab, warden_tab, incharge_tab');

// 2. Update Login.jsx
const loginPath = path.join(__dirname, '../frontend-react/src/pages/Login.jsx');
let loginContent = fs.readFileSync(loginPath, 'utf8');

const targetTabs = `<Tabs value={role} onValueChange={switchRole} className="mt-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="student">{t("auth.student_tab", "Student")}</TabsTrigger>
              <TabsTrigger value="staff">{t("nav.staff", "Staff")}</TabsTrigger>
              <TabsTrigger value="warden">{t("common.hostel_administration", "Warden")}</TabsTrigger>
              <TabsTrigger value="incharge">{t("common.operations_intelligence", "Incharge")}</TabsTrigger>
            </TabsList>
          </Tabs>`;

const replacementTabs = `<Tabs value={role} onValueChange={switchRole} className="mt-6">
            <TabsList className="grid w-full grid-cols-4 h-11 p-1 bg-muted/70 rounded-xl gap-1.5 border border-border/40">
              <TabsTrigger
                value="student"
                className="rounded-lg text-xs font-semibold px-2 py-1.5 transition-all truncate data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs"
              >
                {t("auth.student_tab", "Student")}
              </TabsTrigger>
              <TabsTrigger
                value="staff"
                className="rounded-lg text-xs font-semibold px-2 py-1.5 transition-all truncate data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs"
              >
                {t("auth.staff_tab", "Staff")}
              </TabsTrigger>
              <TabsTrigger
                value="warden"
                className="rounded-lg text-xs font-semibold px-2 py-1.5 transition-all truncate data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs"
              >
                {t("auth.warden_tab", "Warden")}
              </TabsTrigger>
              <TabsTrigger
                value="incharge"
                className="rounded-lg text-xs font-semibold px-2 py-1.5 transition-all truncate data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs"
              >
                {t("auth.incharge_tab", "Incharge")}
              </TabsTrigger>
            </TabsList>
          </Tabs>`;

if (loginContent.includes(targetTabs)) {
  loginContent = loginContent.replace(targetTabs, replacementTabs);
  fs.writeFileSync(loginPath, loginContent, 'utf8');
  console.log('✅ Updated Login.jsx tabs markup');
} else {
  console.log('⚠️ Could not find exact targetTabs block, trying regex match');
  const tabsRegex = /<Tabs value=\{role\}[\s\S]*?<\/Tabs>/;
  loginContent = loginContent.replace(tabsRegex, replacementTabs);
  fs.writeFileSync(loginPath, loginContent, 'utf8');
  console.log('✅ Updated Login.jsx tabs markup via regex');
}

