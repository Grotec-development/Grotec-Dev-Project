"use strict";
/**
 * Authoritative Master Geographic Data & Parent-Child Validation
 * Based on the Local Government Directory (LGD) for South Indian Agricultural States.
 * Used across Frontend and Backend to enforce parent-child geographic integrity:
 * State -> District -> Taluk/Subdistrict -> Village -> PIN Code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TALUKS_BY_DISTRICT = exports.DISTRICTS_BY_STATE = exports.VALID_STATES = void 0;
exports.validateParentChildGeographic = validateParentChildGeographic;
const districts_1 = require("./districts");
exports.VALID_STATES = [
    'Tamil Nadu',
    'Andhra Pradesh',
    'Telangana',
    'Karnataka',
    'Kerala',
];
exports.DISTRICTS_BY_STATE = {
    'Tamil Nadu': [
        'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri',
        'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanniyakumari', 'Karur',
        'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'The Nilgiris',
        'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga',
        'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukkudi', 'Tiruchirappalli', 'Tirunelveli',
        'Tirupathur', 'Tiruppur', 'Thiruvallur', 'Tiruvannamalai', 'Thiruvarur', 'Vellore',
        'Viluppuram', 'Virudhunagar',
    ],
    'Andhra Pradesh': [
        'Alluri Sitharama Raju', 'Anakapalli', 'Ananthapuramu', 'Annamayya', 'Bapatla',
        'Chittoor', 'Dr. B.R. Ambedkar Konaseema', 'East Godavari', 'Eluru', 'Guntur',
        'Kakinada', 'Krishna', 'Kurnool', 'Nandyal', 'NTR', 'Palnadu', 'Parvathipuram Manyam',
        'Prakasam', 'Sri Potti Sriramulu Nellore', 'Sri Sathya Sai', 'Srikakulam',
        'Tirupati', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'Y.S.R. Kadapa',
    ],
    'Telangana': [
        'Adilabad', 'Bhadradri Kothagudem', 'Hanumakonda', 'Hyderabad', 'Jagtial', 'Jangaon',
        'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam',
        'Kumuram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak',
        'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal',
        'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Ranga Reddy', 'Sangareddy', 'Siddipet',
        'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal', 'Yadadri Bhuvanagiri',
    ],
    'Karnataka': [
        'Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar',
        'Chamarajanagar', 'Chikkaballapura', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada',
        'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi', 'Kodagu',
        'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga',
        'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayanagara', 'Vijayapura', 'Yadgir',
    ],
    'Kerala': [
        'Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam', 'Kottayam',
        'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Thiruvananthapuram',
        'Thrissur', 'Wayanad',
    ],
};
/**
 * Keyed by canonical lower-case district key -> array of taluks.
 */
exports.TALUKS_BY_DISTRICT = {
    // Tamil Nadu
    coimbatore: ['Anaimalai', 'Annur', 'Coimbatore North', 'Coimbatore South', 'Kinathukadavu', 'Madukkari', 'Mettupalayam', 'Perur', 'Pollachi', 'Sulur', 'Valparai'],
    tiruppur: ['Avinashi', 'Dharapuram', 'Kangeyam', 'Madathukulam', 'Oothukuli', 'Palladam', 'Tiruppur North', 'Tiruppur South', 'Udumalaipettai'],
    dharmapuri: ['Dharmapuri', 'Harur', 'Karimangalam', 'Nallampalli', 'Palacode', 'Pappireddipatti', 'Pennagaram'],
    salem: ['Attur', 'Edappadi', 'Gangavalli', 'Kadayampatti', 'Mettur', 'Omalur', 'Pethanaickenpalayam', 'Salem', 'Salem South', 'Salem West', 'Sankari', 'Valapady', 'Yercaud'],
    erode: ['Anthiyur', 'Bhavani', 'Erode', 'Gobichettipalayam', 'Kodumudi', 'Modakkurichi', 'Nambiyur', 'Perundurai', 'Sathyamangalam', 'Thalavadi'],
    namakkal: ['Kolli Hills', 'Kumarapalayam', 'Mohanur', 'Namakkal', 'Paramathi Velur', 'Rasipuram', 'Sendamangalam', 'Tiruchengode'],
    krishnagiri: ['Anchetti', 'Bargur', 'Denkanikottai', 'Hosur', 'Kelamangalam', 'Krishnagiri', 'Pochampalli', 'Shoolagiri', 'Uthangarai'],
    dindigul: ['Athoor', 'Dindigul East', 'Dindigul West', 'Gujiliamparai', 'Kodaikanal', 'Natham', 'Nilakottai', 'Oddanchatram', 'Palani', 'Reddiarchatram', 'Vedasandur'],
    madurai: ['Alanganallur', 'Chellampatti', 'Kalligudi', 'Kottampatti', 'Madurai East', 'Madurai North', 'Madurai South', 'Madurai West', 'Melur', 'Sedapatti', 'T. Vadipatti', 'Thirumangalam', 'Thiruparankundram', 'Usilampatti'],
    theni: ['Andipatti', 'Bodinayakanur', 'Chinnamanur', 'Periyakulam', 'Theni', 'Uthamapalayam'],
    thanjavur: ['Budalur', 'Kumbakonam', 'Orathanadu', 'Papanasam', 'Pattukkottai', 'Peravurani', 'Sethubhavachatram', 'Thanjavur', 'Thiruvaiyaru', 'Thiruvidaimarudur'],
    tiruchirappalli: ['Lalgudi', 'Manachanallur', 'Manapparai', 'Marungapuri', 'Musiri', 'Srirangam', 'Thottiyam', 'Thuraiyur', 'Tiruchirappalli East', 'Tiruchirappalli West'],
    thiruvarur: ['Kodavasal', 'Koothanallur', 'Kudavasal', 'Mannargudi', 'Muthupet', 'Nannilam', 'Needamangalam', 'Thiruthuraipoondi', 'Thiruvarur', 'Valangaiman'],
    nagapattinam: ['Kilvelur', 'Nagapattinam', 'Thirukkuvalai', 'Vedaranyam'],
    mayiladuthurai: ['Kuthalam', 'Mayiladuthurai', 'Sirkazhi', 'Tharangambadi'],
    cuddalore: ['Bhuvanagiri', 'Chidambaram', 'Cuddalore', 'Kattumannarkoil', 'Kurinjipadi', 'Panruti', 'Srimushnam', 'Tittakudi', 'Veppur', 'Vriddhachalam'],
    ariyalur: ['Andimadam', 'Ariyalur', 'Sendurai', 'Udayarpalayam'],
    perambalur: ['Alathur', 'Kunnam', 'Perambalur', 'Veppanthattai'],
    pudukkottai: ['Alangudi', 'Aranthangi', 'Avudaiyarkoil', 'Gandarvakottai', 'Illuppur', 'Karambakudi', 'Kulathur', 'Manamelkudi', 'Ponnamaravathi', 'Pudukkottai', 'Thirumayam', 'Viralimalai'],
    sivaganga: ['Devakottai', 'Ilayangudi', 'Kalaiyarkovil', 'Karaikudi', 'Manamadurai', 'Sivaganga', 'Singampunari', 'Thirupuvanam', 'Tirupathur'],
    virudhunagar: ['Aruppukkottai', 'Kariyapatti', 'Rajapalayam', 'Sathur', 'Sivakasi', 'Srivilliputhur', 'Tiruchuli', 'Vembakottai', 'Virudhunagar', 'Watrap'],
    ramanathapuram: ['Kadaladi', 'Kamuthi', 'Keezhakarai', 'Mudukulathur', 'Paramakudi', 'Rajasingamangalam', 'Ramanathapuram', 'Rameswaram', 'Tiruvadanai'],
    tirunelveli: ['Ambasamudram', 'Cheranmahadevi', 'Manur', 'Nanguneri', 'Palayamkottai', 'Radhapuram', 'Tisayanvilai', 'Tirunelveli'],
    tenkasi: ['Alangulam', 'Kadayanallur', 'Sankarankovil', 'Shenkottai', 'Sivagiri', 'Tenkasi', 'Thiruvengadam', 'Veerakeralamputhur'],
    thoothukkudi: ['Eral', 'Ettayapuram', 'Kayathar', 'Kovilpatti', 'Ottapidaram', 'Sathankulam', 'Srivaikuntam', 'Thoothukkudi', 'Tiruchendur', 'Vilathikulam'],
    kanniyakumari: ['Agastheeswaram', 'Kalkulam', 'Killiyoor', 'Thiruvattar', 'Thovalai', 'Vilavancode'],
    vellore: ['Anaicut', 'Gudiyatham', 'Katpadi', 'K.V. Kuppam', 'Pernambut', 'Vellore'],
    ranipet: ['Arakkonam', 'Arcot', 'Kalavai', 'Nemili', 'Ranipet', 'Sholinghur', 'Walajah'],
    tirupathur: ['Ambur', 'Natrampalli', 'Tirupathur', 'Vaniyambadi'],
    tiruvannamalai: ['Arani', 'Chengam', 'Chetpet', 'Jamunamarathur', 'Kalasapakkam', 'Kilpennathur', 'Polur', 'Thandarampattu', 'Tiruvannamalai', 'Vandavasi', 'Vembakkam'],
    kanchipuram: ['Kanchipuram', 'Kundrathur', 'Sriperumbudur', 'Uthiramerur', 'Walajabad'],
    chengalpattu: ['Chengalpattu', 'Cheyyur', 'Maduranthakam', 'Pallavaram', 'Tambaram', 'Tirukalukundram', 'Tiruporur', 'Vandalur'],
    thiruvallur: ['Avadi', 'Gummidipoondi', 'Pallipattu', 'Ponneri', 'Poonamallee', 'R.K. Pet', 'Thiruvallur', 'Tiruttani', 'Uthukottai'],
    chennai: ['Alandur', 'Ambattur', 'Aminjikarai', 'Ayanavaram', 'Egmore', 'Guindy', 'Kolathur', 'Maduravoyal', 'Mambalam', 'Mathavaram', 'Mylapore', 'Perambur', 'Purasawalkam', 'Sholinganallur', 'Tiruvottiyur', 'Tondiarpet', 'Velachery'],
    viluppuram: ['Gingee', 'Kandachipuram', 'Marakkanam', 'Melmalayanur', 'Thiruvennainallur', 'Tindivanam', 'Vanur', 'Vikravandi', 'Viluppuram'],
    kallakurichi: ['Chinnasalem', 'Kalvarayan Hills', 'Kallakurichi', 'Sankarapuram', 'Tirukoilur', 'Ulundurpet'],
    'the nilgiris': ['Coonoor', 'Gudalur', 'Kotagiri', 'Kundah', 'Pandalur', 'Udhagamandalam'],
};
/**
 * Validates a parent-child combination of geographic fields.
 * Rules:
 * - Empty fields are permitted (incomplete imported addresses are not rejected).
 * - If state is provided, it must be recognized if strict validation is desired.
 * - If district is provided with a valid state, district must belong to that state.
 * - If taluk is provided with a district, taluk must belong to that district.
 *
 * @param {{ state?: string | null, district?: string | null, taluk?: string | null }} loc
 * @returns {{ valid: boolean, error?: string, message?: string }}
 */
function validateParentChildGeographic(loc) {
    if (!loc)
        return { valid: true, isValid: true };
    const rawState = loc.state ? String(loc.state).trim() : '';
    const rawDistrict = loc.district ? String(loc.district).trim() : '';
    const rawTaluk = loc.taluk ? String(loc.taluk).trim() : '';
    // 1. If state provided, match against known states (case-insensitive)
    let matchedState = null;
    if (rawState) {
        matchedState = exports.VALID_STATES.find(s => s.toLowerCase() === rawState.toLowerCase());
        if (!matchedState) {
            // If state is unknown, reject if strictly invalid
            return {
                valid: false,
                isValid: false,
                error: 'INVALID_GEOGRAPHY',
                code: 'INVALID_GEOGRAPHY',
                reason: 'INVALID_STATE',
                message: `State "${rawState}" is not recognized in the master geographic catalogue.`,
            };
        }
    }
    // 2. If district provided:
    if (rawDistrict) {
        const canonicalKey = (0, districts_1.canonicalDistrictKey)(rawDistrict);
        // Check state-district parent-child validity if state is known
        if (matchedState) {
            const stateDistricts = exports.DISTRICTS_BY_STATE[matchedState] || [];
            const districtMatches = stateDistricts.some(d => (0, districts_1.canonicalDistrictKey)(d) === canonicalKey);
            if (!districtMatches) {
                return {
                    valid: false,
                    isValid: false,
                    error: 'INVALID_GEOGRAPHY',
                    code: 'INVALID_GEOGRAPHY',
                    reason: 'INVALID_DISTRICT_FOR_STATE',
                    message: `District "${rawDistrict}" does not belong to State "${matchedState}".`,
                };
            }
        }
        // 3. If taluk is provided, verify it belongs to the district
        if (rawTaluk) {
            const validTaluks = exports.TALUKS_BY_DISTRICT[canonicalKey];
            if (validTaluks && validTaluks.length > 0) {
                const talukMatches = validTaluks.some(t => t.toLowerCase() === rawTaluk.toLowerCase());
                if (!talukMatches) {
                    return {
                        valid: false,
                        isValid: false,
                        error: 'INVALID_GEOGRAPHY',
                        code: 'INVALID_GEOGRAPHY',
                        reason: 'INVALID_TALUK_FOR_DISTRICT',
                        message: `Taluk "${rawTaluk}" is not a valid taluk/subdistrict of District "${rawDistrict}".`,
                    };
                }
            }
        }
    }
    return { valid: true, isValid: true };
}
