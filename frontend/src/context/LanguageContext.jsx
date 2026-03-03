import { createContext, useContext, useState } from 'react'

const LanguageContext = createContext()

/* ── Full Hindi translation dictionary ──────────────────────────────────────
   Rules:
   - Technical values (email, phone, animal_id, PIN, IDs) stay in English
   - All UI labels, headings, buttons, messages translate to Hindi
   ───────────────────────────────────────────────────────────────────────── */
export const translations = {
    // ── Navbar ──
    'Home': 'होम',
    'Find Animal': 'पशु खोजें',
    'Help Nearby': 'पास की सहायता',
    'My Animals': 'मेरे पशु',
    'Add Animal': 'पशु जोड़ें',
    'Breed Check': 'नस्ल जांच',
    'Scan': 'स्कैन',
    'Sign In': 'लॉग इन',
    'Sign Up': 'साइन अप',
    'Logout': 'लॉग आउट',
    'My Profile': 'मेरी प्रोफाइल',
    'Alerts & Notifications': 'अलर्ट और सूचनाएं',
    'Vaccine Schedule': 'टीकाकरण अनुसूची',
    'Transfer History': 'स्थानांतरण इतिहास',
    'Find Nearby Vets': 'पास के पशु चिकित्सक',

    // ── Home page ──
    'Register & Track Your Animals': 'अपने पशुओं को पंजीकृत करें और ट्रैक करें',
    'Smart Animal ID & Management': 'स्मार्ट पशु आईडी और प्रबंधन',
    'AI-Powered Breed Detection': 'AI-संचालित नस्ल पहचान',
    'Scan QR Code': 'QR कोड स्कैन करें',
    'Get Started': 'शुरू करें',
    'Learn More': 'और जानें',
    'Register Animal': 'पशु पंजीकृत करें',
    'View Dashboard': 'डैशबोर्ड देखें',
    'Detect Breed': 'नस्ल पहचानें',

    // ── Dashboard ──
    'Dashboard': 'डैशबोर्ड',
    'Animals Registered': 'पंजीकृत पशु',
    'Total Animals': 'कुल पशु',
    'Vaccinations Due': 'टीकाकरण बाकी',
    'Health Alerts': 'स्वास्थ्य अलर्ट',
    'Update Record': 'रिकॉर्ड अपडेट करें',
    'Delete': 'हटाएं',
    'Transferred': 'स्थानांतरित',
    'No animals registered yet': 'अभी तक कोई पशु पंजीकृत नहीं',
    'Add your first animal': 'अपना पहला पशु जोड़ें',
    'Search animals': 'पशु खोजें',
    'Filter': 'फ़िल्टर',
    'All': 'सभी',
    'Cattle': 'गाय/बैल',
    'Buffalo': 'भैंस',

    // ── Animal registration ──
    'Register New Animal': 'नया पशु पंजीकृत करें',
    'Animal Details': 'पशु विवरण',
    'Owner Details': 'मालिक विवरण',
    'Location': 'स्थान',
    'Health Status': 'स्वास्थ्य स्थिति',
    'Species': 'प्रजाति',
    'Breed': 'नस्ल',
    'Gender': 'लिंग',
    'Male': 'नर',
    'Female': 'मादा',
    'Date of Birth': 'जन्म तिथि',
    'Age': 'आयु',
    'Color': 'रंग',
    'Weight': 'वजन',
    'Purpose': 'उद्देश्य',
    'Owner Name': 'मालिक का नाम',
    'Village': 'गांव',
    'District': 'जिला',
    'State': 'राज्य',
    'City': 'शहर',
    'Healthy': 'स्वस्थ',
    'Sick': 'बीमार',
    'Under Treatment': 'उपचाराधीन',
    'Submit': 'जमा करें',
    'Cancel': 'रद्द करें',
    'Save': 'सहेजें',
    'Next': 'अगला',
    'Back': 'वापस',
    'Confirm': 'पुष्टि करें',

    // ── QR Scanner ──
    'QR Identity Scan': 'QR पहचान स्कैन',
    'Scan any animal QR code': 'कोई भी पशु QR कोड स्कैन करें',
    'Camera Scan': 'कैमरा स्कैन',
    'Upload Image': 'छवि अपलोड करें',
    'Scan This QR': 'QR स्कैन करें',
    'Change Image': 'छवि बदलें',
    'Rescan': 'फिर स्कैन करें',
    'Full Profile': 'पूरी प्रोफाइल',
    'Animal Info': 'पशु जानकारी',
    'Owner History': 'मालिक इतिहास',
    'Vaccinations': 'टीकाकरण',
    'Nearby Services': 'पास की सेवाएं',
    'Verified': 'सत्यापित',
    'Not Found': 'नहीं मिला',
    'Start Camera': 'कैमरा शुरू करें',

    // ── Animal Profile ──
    'Animal Profile': 'पशु प्रोफाइल',
    'Health': 'स्वास्थ्य',
    'Vaccination': 'टीकाकरण',
    'Transfer': 'स्थानांतरण',
    'Transfer Ownership': 'स्वामित्व स्थानांतरण',
    'Current Owner': 'वर्तमान मालिक',
    'Previous Owners': 'पिछले मालिक',
    'Vaccination History': 'टीकाकरण इतिहास',
    'Add Vaccination': 'टीकाकरण जोड़ें',
    'No vaccination records': 'कोई टीकाकरण रिकॉर्ड नहीं',
    'Vaccine Name': 'टीके का नाम',
    'Date Given': 'दिनांक',
    'Next Due': 'अगली तारीख',
    'Administered By': 'किसने दिया',
    'Download QR': 'QR डाउनलोड करें',
    'Edit': 'संपादित करें',
    'Reason for Transfer': 'स्थानांतरण का कारण',
    'Recipient Email': 'प्राप्तकर्ता ईमेल',
    'Recipient Phone': 'प्राप्तकर्ता फोन',
    'Look Up Recipient': 'प्राप्तकर्ता खोजें',
    'Confirm Transfer': 'स्थानांतरण पुष्टि करें',

    // ── Nearby search ──
    'Find Nearby Animal Services': 'पास की पशु सेवाएं खोजें',
    'Vet Hospital': 'पशु चिकित्सालय',
    'Gaushala': 'गौशाला',
    'NGO / Welfare': 'एनजीओ / कल्याण',
    'Animal Shelter': 'पशु आश्रय',
    'Get Directions': 'दिशा-निर्देश पाएं',
    'Use My Location (GPS)': 'मेरा स्थान उपयोग करें (GPS)',
    'Search': 'खोजें',
    'No results found': 'कोई परिणाम नहीं मिला',
    'Enter city or district': 'शहर या जिला दर्ज करें',

    // ── Breed detector ──
    'AI Breed Detector': 'AI नस्ल पहचानकर्ता',
    'Upload Animal Photo': 'पशु फोटो अपलोड करें',
    'Detected Breed': 'पहचानी गई नस्ल',
    'Confidence': 'विश्वसनीयता',
    'Top Predictions': 'शीर्ष अनुमान',
    'Try Another': 'और प्रयास करें',

    // ── Auth ──
    'Login': 'लॉग इन',
    'Register': 'पंजीकरण',
    'Full Name': 'पूरा नाम',
    'Password': 'पासवर्ड',
    'Confirm Password': 'पासवर्ड की पुष्टि',
    'Already have an account?': 'पहले से खाता है?',
    "Don't have an account?": 'खाता नहीं है?',
    'Create Account': 'खाता बनाएं',
    'Welcome back': 'वापसी पर स्वागत है',

    // ── User Profile ──
    'User Profile': 'उपयोगकर्ता प्रोफाइल',
    'Account Details': 'खाता विवरण',
    'Notifications': 'सूचनाएं',
    'No alerts': 'कोई अलर्ट नहीं',
    'Upcoming vaccinations': 'आगामी टीकाकरण',

    // ── General ──
    'Loading': 'लोड हो रहा है',
    'Error': 'त्रुटि',
    'Success': 'सफल',
    'Close': 'बंद करें',
    'View': 'देखें',
    'Download': 'डाउनलोड',
    'Share': 'साझा करें',
    'Print': 'प्रिंट',
    'days away': 'दिन बाकी',
    'Today': 'आज',
    'Overdue': 'समय निकल गया',
    'km away': 'किमी दूर',
    'Visit Website': 'वेबसाइट देखें',
    'Get Directions →': 'दिशा पाएं →',
    'Also Browse on Google Maps': 'गूगल मैप्स पर भी देखें',
    'Profile · Alerts · History': 'प्रोफाइल · अलर्ट · इतिहास',
    'Smart Animal ID': 'स्मार्ट पशु आईडी',
}

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState(() => localStorage.getItem('saioms_lang') || 'en')

    const toggleLang = () => {
        setLang(l => {
            const next = l === 'en' ? 'hi' : 'en'
            localStorage.setItem('saioms_lang', next)
            return next
        })
    }

    /** Translate a string. If lang is English or translation not found, returns original. */
    const t = (str) => {
        if (lang === 'en' || !str) return str
        return translations[str] || str
    }

    return (
        <LanguageContext.Provider value={{ lang, toggleLang, t, isHindi: lang === 'hi' }}>
            {children}
        </LanguageContext.Provider>
    )
}

export const useLang = () => useContext(LanguageContext)
