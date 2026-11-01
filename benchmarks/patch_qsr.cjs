const fs = require('fs');
const path = require('path');

const qsrPath = path.join(__dirname, '../frontend-react/src/components/hms/QuickServiceReporter.jsx');
let content = fs.readFileSync(qsrPath, 'utf8');

const targetOld = `const QUICK_SERVICES = [
  {
    quickCategory: "NO_WATER_SUPPLY",
    category: "Plumbing",
    label: t("categories.NO_WATER_SUPPLY", "No water supply"),
    icon: Droplet,
    colorClass: "text-blue-500 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20",
    title: "No water supply in room",
  },
  {
    quickCategory: "NO_ELECTRICITY",
    category: "Electrical",
    label: t("categories.NO_ELECTRICITY", "No electricity"),
    icon: Zap,
    colorClass: "text-amber-500 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20",
    title: "No electricity outage in room",
  },
  {
    quickCategory: "WIFI_NOT_WORKING",
    category: "Internet",
    label: t("categories.WIFI_NOT_WORKING", "Wi-Fi not working"),
    icon: Wifi,
    colorClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20",
    title: "Wi-Fi connection problem in room",
  },
];`;

const replacementConfig = `const QUICK_SERVICES_CONFIG = [
  {
    quickCategory: "NO_WATER_SUPPLY",
    category: "Plumbing",
    labelKey: "categories.NO_WATER_SUPPLY",
    defaultLabel: "No water supply",
    icon: Droplet,
    colorClass: "text-blue-500 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20",
    title: "No water supply in room",
  },
  {
    quickCategory: "NO_ELECTRICITY",
    category: "Electrical",
    labelKey: "categories.NO_ELECTRICITY",
    defaultLabel: "No electricity",
    icon: Zap,
    colorClass: "text-amber-500 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20",
    title: "No electricity outage in room",
  },
  {
    quickCategory: "WIFI_NOT_WORKING",
    category: "Internet",
    labelKey: "categories.WIFI_NOT_WORKING",
    defaultLabel: "Wi-Fi not working",
    icon: Wifi,
    colorClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20",
    title: "Wi-Fi connection problem in room",
  },
];`;

content = content.replace(/\r\n/g, '\n');
content = content.replace(targetOld.replace(/\r\n/g, '\n'), replacementConfig);

const targetInsideComp = `  const [activeCheckCategory, setActiveCheckCategory] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);`;

const replacementInsideComp = `  const [activeCheckCategory, setActiveCheckCategory] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const quickServices = QUICK_SERVICES_CONFIG.map((s) => ({
    ...s,
    label: t(s.labelKey, s.defaultLabel),
  }));`;

content = content.replace(targetInsideComp, replacementInsideComp);
content = content.replace(/QUICK_SERVICES\.map/g, 'quickServices.map');

fs.writeFileSync(qsrPath, content, 'utf8');
console.log('✅ QuickServiceReporter.jsx patched successfully!');

