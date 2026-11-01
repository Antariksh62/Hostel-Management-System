/**
 * complaintTranslator.js
 * 
 * Production-grade translation engine for Complaint Titles, Descriptions,
 * and Resolution Notes into Hindi ('hi') and Marathi ('mr').
 * 
 * Preserves room numbers (e.g. "Room 204"), PRNs, emails, and technical IDs.
 */

// ─── 1. Canonical Exact Phrases (Seed, Quick-Actions & Common Hostel Tickets) ───
const EXACT_PHRASES = {
  // Existing Database Complaints
  "Broken Fan in Room 204": {
    hi: "कमरा 204 में खराब पंखा",
    mr: "खोली 204 मधील बंद/तुटलेला पंखा"
  },
  "The ceiling fan is making weird noises and constantly slowing down.": {
    hi: "सीलिंग फैन अजीब आवाज कर रहा है और लगातार धीमा हो रहा है।",
    mr: "छताचा पंखा विचित्र आवाज करत आहे आणि सतत संथ होत आहे."
  },
  "Water Leakage in Bathroom 3": {
    hi: "बाथरूम 3 में पानी का रिसाव",
    mr: "बाथरूम 3 मध्ये पाण्याची गळती"
  },
  "The shower head keeps dripping continuously since yesterday.": {
    hi: "कल से शॉवर से लगातार पानी टपक रहा है।",
    mr: "कालपासून शॉवरमधून सतत पाणी गळत आहे."
  },
  "No Internet Connection": {
    hi: "इंटरनेट कनेक्शन नहीं है",
    mr: "इंटरनेट कनेक्शन नाही"
  },
  "The router on the 2nd floor is completely dead.": {
    hi: "दूसरी मंजिल का राउटर पूरी तरह बंद है।",
    mr: "दुसऱ्या मजल्यावरील राऊटर पूर्णपणे बंद आहे."
  },
  "Broken Window Latch": {
    hi: "खिड़की की कुंडी टूटी हुई है",
    mr: "खिडकीची कडी तुटलेली आहे"
  },
  "The window on the left side of the room won't lock properly.": {
    hi: "कमरे की बाईं ओर की खिड़की ठीक से बंद नहीं हो रही है।",
    mr: "खोलीच्या डाव्या बाजूची खिडकी नीट बंद/लॉक होत नाही."
  },
  "Blocked Sink": {
    hi: "सिंक जाम/अवरुद्ध है",
    mr: "वॉशबेसिन तुंबलेले आहे"
  },
  "Water isn't draining from the main washbasin in the corridor.": {
    hi: "कॉरिडोर के मुख्य वॉशबेसिन से पानी नहीं निकल रहा है।",
    mr: "कॉरिडॉरमधील मुख्य वॉशबेसिनमधून पाणी बाहेर जात नाहीये."
  },
  "Dim Tube Light": {
    hi: "धीमी/मंद ट्यूब लाइट",
    mr: "मंद पडलेली ट्यूब लाइट"
  },
  "The main fluorescent light in the room is constantly flickering.": {
    hi: "कमरे की मुख्य फ्लोरोसेंट लाइट लगातार टिमटिमा रही है।",
    mr: "खोलीतील मुख्य फ्लोरोसंट ट्यूब सतत लुकलुकत आहे."
  },
  "AC Not Cooling": {
    hi: "एसी ठंडा नहीं कर रहा है",
    mr: "एसी थंड हवा देत नाही"
  },
  "The air conditioner turns on but blows out warm air.": {
    hi: "एयर कंडीशनर चालू तो होता है लेकिन गर्म हवा फेंक रहा है।",
    mr: "एअर कंडिशनर सुरू होतो पण गरम हवा फेकतो."
  },
  "Flickering Tube Light in Room 204": {
    hi: "कमरा 204 में टिमटिमाती ट्यूब लाइट",
    mr: "खोली 204 मधील लुकलुकणारी ट्यूब लाइट"
  },
  "The main tube light in room 204 is constantly flickering and needs replacement.": {
    hi: "कमरा 204 में मुख्य ट्यूब लाइट लगातार टिमटिमा रही है और इसे बदलने की आवश्यकता है।",
    mr: "खोली 204 मधील मुख्य ट्यूब लाइट सतत लुकलुकत आहे आणि ती बदलण्याची गरज आहे."
  },
  "room is not cleaned": {
    hi: "कमरे की सफाई नहीं हुई है",
    mr: "खोलीची स्वच्छता केलेली नाही"
  },
  "room's door backside is uncleaned": {
    hi: "कमरे के दरवाजे के पीछे का हिस्सा साफ नहीं है",
    mr: "खोलीच्या दरवाजाच्या मागची बाजू अस्वच्छ आहे"
  },

  // Quick Service Actions
  "No water supply in room": {
    hi: "कमरे में पानी की आपूर्ति नहीं है",
    mr: "खोलीत पाणी पुरवठा नाही"
  },
  "No electricity outage in room": {
    hi: "कमरे में बिजली नहीं है",
    mr: "खोलीत वीज गेलेली आहे"
  },
  "Wi-Fi connection problem in room": {
    hi: "कमरे में वाई-फाई कनेक्शन की समस्या है",
    mr: "खोलीत वाय-फाय कनेक्शनची समस्या आहे"
  },

  // Common Hostel Complaints
  "Fan Not Working": {
    hi: "पंखा काम नहीं कर रहा है",
    mr: "पंखा बंद आहे / चालत नाही"
  },
  "Tube light flickering or not working": {
    hi: "ट्यूब लाइट टिमटिमा रही है या काम नहीं कर रही है",
    mr: "ट्यूब लाइट लुकलुकत आहे किंवा बंद आहे"
  },
  "Switch board loose or sparking": {
    hi: "स्विच बोर्ड ढीला है या चिंगारी निकल रही है",
    mr: "स्विच बोर्ड सैल आहे किंवा स्पार्किंग होत आहे"
  },
  "Charging socket not working": {
    hi: "चार्जिंग सॉकेट काम नहीं कर रहा है",
    mr: "चार्जिंग सॉकेट बंद आहे"
  },
  "No water in washroom": {
    hi: "वॉशरूम में पानी नहीं है",
    mr: "वॉशरूममध्ये पाणी नाही"
  },
  "Tap leaking or broken": {
    hi: "नल टपक रहा है या टूटा हुआ है",
    mr: "नळ गळत आहे किंवा तुटलेला आहे"
  },
  "Flush not working": {
    hi: "फ्लश काम नहीं कर रहा है",
    mr: "फ्लश काम करत नाही"
  },
  "Washbasin clogged or leaking": {
    hi: "वॉशबेसिन जाम है या लीक हो रहा है",
    mr: "वॉशबेसिन तुंबलेले आहे किंवा गळत आहे"
  },
  "Door lock jammed or broken": {
    hi: "दरवाजे का ताला जाम है या टूटा हुआ है",
    mr: "दरवाजाचे कुलूप जाम किंवा तुटलेले आहे"
  },
  "Window latch broken or stuck": {
    hi: "खिड़की की कुंडी टूटी हुई या अटकी हुई है",
    mr: "खिडकीची कडी तुटलेली किंवा अडकलेली आहे"
  },
  "Cupboard handle loose": {
    hi: "अलमारी का हैंडल ढीला है",
    mr: "कपाटाचे हँडल सैल आहे"
  },
  "Bed/study table damaged": {
    hi: "पलंग/स्टडी टेबल क्षतिग्रस्त है",
    mr: "खाट/अभ्यासाचे टेबल खराब झाले आहे"
  },
  "Room cleaning required": {
    hi: "कमरे की सफाई आवश्यक है",
    mr: "खोलीची स्वच्छता करणे आवश्यक आहे"
  },
  "Corridor trash cleanup": {
    hi: "कॉरिडोर में कचरे की सफाई",
    mr: "कॉरिडॉरमधील कचरा साफ करणे"
  },
  "Washroom deep cleaning": {
    hi: "वॉशरूम की गहन सफाई",
    mr: "वॉशरूमची सखोल स्वच्छता"
  },
  "Dustbin clearance": {
    hi: "कूड़ेदान खाली करना",
    mr: "कचराकुंडी रिकामी करणे"
  },
  "Geyser not heating": {
    hi: "गीजर पानी गर्म नहीं कर रहा है",
    mr: "गिझर पाणी गरम करत नाही"
  },
  "Water cooler not cooling": {
    hi: "वॉटर कूलर ठंडा पानी नहीं दे रहा है",
    mr: "वॉटर कुलर थंड पाणी देत नाही"
  }
};

// ─── 2. Domain Vocabulary Dictionary ──────────────────────────────────────────
const VOCABULARY = {
  // Appliances & Fixtures
  "ceiling fan": { hi: "सीलिंग फैन", mr: "छताचा पंखा" },
  "fan": { hi: "पंखा", mr: "पंखा" },
  "tube light": { hi: "ट्यूब लाइट", mr: "ट्यूब लाइट" },
  "tubelight": { hi: "ट्यूब लाइट", mr: "ट्यूब लाइट" },
  "light": { hi: "लाइट", mr: "लाइट" },
  "fluorescent light": { hi: "फ्लोरोसेंट लाइट", mr: "फ्लोरोसंट लाइट" },
  "bulb": { hi: "बल्ब", mr: "बल्ब" },
  "switch board": { hi: "स्विच बोर्ड", mr: "स्विच बोर्ड" },
  "switchboard": { hi: "स्विच बोर्ड", mr: "स्विच बोर्ड" },
  "switch": { hi: "स्विच", mr: "स्विच" },
  "socket": { hi: "सॉकेट", mr: "सॉकेट" },
  "plug": { hi: "प्लग", mr: "प्लग" },
  "air conditioner": { hi: "एयर कंडीशनर", mr: "एअर कंडिशनर" },
  "ac": { hi: "एसी", mr: "एसी" },
  "cooler": { hi: "कूलर", mr: "कुलर" },
  "water cooler": { hi: "वॉटर कूलर", mr: "वॉटर कुलर" },
  "geyser": { hi: "गीजर", mr: "गिझर" },
  "heater": { hi: "हीटर", mr: "हीटर" },
  "tap": { hi: "नल", mr: "नळ" },
  "faucet": { hi: "नल", mr: "नळ" },
  "shower head": { hi: "शॉवर हेड", mr: "शॉवर" },
  "shower": { hi: "शॉवर", mr: "शॉवर" },
  "washbasin": { hi: "वॉशबेसिन", mr: "वॉशबेसिन" },
  "wash basin": { hi: "वॉशबेसिन", mr: "वॉशबेसिन" },
  "sink": { hi: "सिंक", mr: "सिंक" },
  "flush tank": { hi: "फ्लश टैंक", mr: "फ्लश टाकी" },
  "flush": { hi: "फ्लश", mr: "फ्लश" },
  "toilet": { hi: "टॉयलेट", mr: "शौचालय" },
  "commode": { hi: "कमोड", mr: "कमोड" },
  "pipe": { hi: "पाइप", mr: "पाईप" },
  "drainage": { hi: "ड्रेनेज", mr: "ड्रेनेज" },
  "drain": { hi: "नाली/ड्रेन", mr: "ड्रेन" },
  "water": { hi: "पानी", mr: "पाणी" },
  "door": { hi: "दरवाजा", mr: "दरवाजा" },
  "window latch": { hi: "खिड़की की कुंडी", mr: "खिडकीची कडी" },
  "window": { hi: "खिड़की", mr: "खिडकी" },
  "latch": { hi: "कुंडी", mr: "कडी" },
  "lock": { hi: "ताला", mr: "कुलूप" },
  "handle": { hi: "हैंडल", mr: "हँडल" },
  "key": { hi: "चाबी", mr: "किल्ली" },
  "bed": { hi: "पलंग", mr: "खाट/पलंग" },
  "study table": { hi: "स्टडी टेबल", mr: "अभ्यासाचे टेबल" },
  "table": { hi: "टेबल", mr: "टेबल" },
  "chair": { hi: "कुर्सी", mr: "खुर्ची" },
  "cupboard": { hi: "अलमारी", mr: "कपाट" },
  "wardrobe": { hi: "अलमारी", mr: "कपाट" },
  "dustbin": { hi: "कूड़ेदान", mr: "कचराकुंडी" },
  "mirror": { hi: "आईना", mr: "आरसा" },
  "router": { hi: "राउटर", mr: "राऊटर" },
  "wifi": { hi: "वाई-फाई", mr: "वाय-फाय" },
  "wi-fi": { hi: "वाई-फाई", mr: "वाय-फाय" },
  "internet": { hi: "इंटरनेट", mr: "इंटरनेट" },

  // Problem States & Defects
  "not working": { hi: "काम नहीं कर रहा है", mr: "काम करत नाही / बंद आहे" },
  "broken": { hi: "टूटा हुआ", mr: "तुटलेले" },
  "damaged": { hi: "क्षतिग्रस्त", mr: "खराब झालेले" },
  "flickering": { hi: "टिमटिमा रहा है", mr: "लुकलुकत आहे" },
  "leaking": { hi: "लीक हो रहा है", mr: "गळत आहे" },
  "leakage": { hi: "रिसाव/गळती", mr: "पाण्याची गळती" },
  "dripping": { hi: "टपक रहा है", mr: "थेंब थेंब गळत आहे" },
  "blocked": { hi: "अवरुद्ध/जाम", mr: "तुंबलेले" },
  "clogged": { hi: "जाम", mr: "तुंबलेले" },
  "loose": { hi: "ढीला", mr: "सैल" },
  "jammed": { hi: "जाम", mr: "अडकलेले/जाम" },
  "stuck": { hi: "अटका हुआ", mr: "अडकलेले" },
  "sparking": { hi: "चिंगारी निकल रही है", mr: "स्पार्किंग होत आहे" },
  "tripping": { hi: "ट्रिप हो रहा है", mr: "ट्रिप होत आहे" },
  "dirty": { hi: "गंदा", mr: "घाणेरडे/अस्वच्छ" },
  "uncleaned": { hi: "अस्वच्छ/साफ नहीं", mr: "स्वच्छ केलेले नाही" },
  "not cleaned": { hi: "साफ नहीं किया गया", mr: "स्वच्छता केलेली नाही" },
  "cleaning": { hi: "सफाई", mr: "स्वच्छता" },
  "needs replacement": { hi: "बदलने की जरूरत है", mr: "बदलण्याची गरज आहे" },
  "replacement": { hi: "बदलना", mr: "बदलणे" },
  "repair": { hi: "मरम्मत", mr: "दुरुस्ती" },
  "dead": { hi: "पूरी तरह बंद", mr: "पूर्णपणे बंद" },
  "dim": { hi: "मंद/धीमा", mr: "मंद" },
  "making noise": { hi: "आवाज कर रहा है", mr: "आवाज करत आहे" },
  "weird noises": { hi: "अजीब आवाजें", mr: "विचित्र आवाज" },
  "slowing down": { hi: "धीमा हो रहा है", mr: "संथ होत आहे" },
  "won't lock": { hi: "बंद/लॉक नहीं हो रहा है", mr: "नीट बंद/लॉक होत नाही" },
  "not draining": { hi: "पानी नहीं निकल रहा है", mr: "पाण्याचा निचरा होत नाही" },

  // Locations & Spatial
  "bathroom": { hi: "बाथरूम", mr: "बाथरूम" },
  "washroom": { hi: "वॉशरूम", mr: "वॉशरूम" },
  "corridor": { hi: "कॉरिडोर", mr: "कॉरिडॉर" },
  "lobby": { hi: "लॉबी", mr: "लॉबी" },
  "balcony": { hi: "बालकनी", mr: "बाल्कनी" },
  "passage": { hi: "पैसेज", mr: "पॅसेज" },
  "floor": { hi: "मंजिल", mr: "मजला" },
  "ground floor": { hi: "भूतल", mr: "तळमजला" },
  "1st floor": { hi: "पहली मंजिल", mr: "पहिला मजला" },
  "2nd floor": { hi: "दूसरी मंजिल", mr: "दुसरा मजला" },
  "3rd floor": { hi: "तीसरी मंजिल", mr: "तिसरा मजला" },
  "4th floor": { hi: "चौथी मंजिल", mr: "चौथा मजला" },
  "5th floor": { hi: "पांचवीं मंजिल", mr: "पाचवा मजला" },
  "left side": { hi: "बाईं ओर", mr: "डाव्या बाजूला" },
  "right side": { hi: "दाईं ओर", mr: "उजव्या बाजूला" },
  "backside": { hi: "पीछे की ओर", mr: "मागची बाजू" }
};

/**
 * Translates any Complaint Title or Description into the target language.
 *
 * @param {string} text - The English complaint text
 * @param {string} lang - 'en' | 'hi' | 'mr'
 * @returns {string} - Translated text in Hindi/Marathi, or original if 'en'
 */
export function translateComplaintText(text, lang) {
  if (!text || typeof text !== "string") return text || "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (!lang || lang === "en") return text;

  // 1. Direct Exact Match
  if (EXACT_PHRASES[trimmed] && EXACT_PHRASES[trimmed][lang]) {
    return EXACT_PHRASES[trimmed][lang];
  }

  // Check case-insensitive exact match
  const lowerKey = Object.keys(EXACT_PHRASES).find(
    (k) => k.toLowerCase() === trimmed.toLowerCase()
  );
  if (lowerKey && EXACT_PHRASES[lowerKey][lang]) {
    return EXACT_PHRASES[lowerKey][lang];
  }

  // 2. Room extraction: "in Room 204", "Room 105", "Bathroom 3"
  let localized = trimmed;

  // Replace "in Room XYZ" / "in room XYZ"
  localized = localized.replace(/in\s+room\s+(\d+)/gi, (_match, num) => {
    return lang === "mr" ? `खोली ${num} मध्ये` : `कमरा ${num} में`;
  });

  // Replace "Room XYZ" / "room XYZ"
  localized = localized.replace(/room\s+(\d+)/gi, (_match, num) => {
    return lang === "mr" ? `खोली ${num}` : `कमरा ${num}`;
  });

  // Replace "Bathroom XYZ"
  localized = localized.replace(/bathroom\s+(\d+)/gi, (_match, num) => {
    return lang === "mr" ? `बाथरूम ${num}` : `बाथरूम ${num}`;
  });

  // 3. Match against known vocabulary phrases (longer phrases first)
  const sortedVocab = Object.entries(VOCABULARY).sort(
    (a, b) => b[0].length - a[0].length
  );

  let hasReplaced = false;
  for (const [enPhrase, transObj] of sortedVocab) {
    if (transObj[lang]) {
      const regex = new RegExp(`\\b${enPhrase}\\b`, "gi");
      if (regex.test(localized)) {
        localized = localized.replace(regex, transObj[lang]);
        hasReplaced = true;
      }
    }
  }

  // 4. Grammar connectors & sentence endings for natural phrasing
  if (hasReplaced) {
    if (lang === "mr") {
      localized = localized
        .replace(/\bconstantly\b/gi, "सतत")
        .replace(/\bcontinuously\b/gi, "सतत")
        .replace(/\bsince yesterday\b/gi, "कालपासून")
        .replace(/\byesterday\b/gi, "काल")
        .replace(/\btoday\b/gi, "आज")
        .replace(/\bcompletely\b/gi, "पूर्णपणे")
        .replace(/\bproperly\b/gi, "व्यवस्थित/नीट")
        .replace(/\bmain\b/gi, "मुख्य")
        .replace(/\bThe\b/g, "")
        .replace(/\bthe\b/g, "")
        .replace(/\band\b/gi, "आणि")
        .replace(/\bwith\b/gi, "सह")
        .replace(/\bis\b/gi, "आहे")
        .replace(/\bare\b/gi, "आहेत")
        .replace(/\bfor\b/gi, "साठी")
        .replace(/\bof\b/gi, "चे/ची");
    } else if (lang === "hi") {
      localized = localized
        .replace(/\bconstantly\b/gi, "लगातार")
        .replace(/\bcontinuously\b/gi, "लगातार")
        .replace(/\bsince yesterday\b/gi, "कल से")
        .replace(/\byesterday\b/gi, "कल")
        .replace(/\btoday\b/gi, "आज")
        .replace(/\bcompletely\b/gi, "पूरी तरह से")
        .replace(/\bproperly\b/gi, "ठीक से")
        .replace(/\bmain\b/gi, "मुख्य")
        .replace(/\bThe\b/g, "")
        .replace(/\bthe\b/g, "")
        .replace(/\band\b/gi, "और")
        .replace(/\bwith\b/gi, "के साथ")
        .replace(/\bis\b/gi, "है")
        .replace(/\bare\b/gi, "हैं")
        .replace(/\bfor\b/gi, "के लिए")
        .replace(/\bof\b/gi, "का/की");
    }
    // Clean up multiple spaces
    localized = localized.replace(/\s+/g, " ").trim();
  }

  return localized || text;
}

