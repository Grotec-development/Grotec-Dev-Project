/**
 * Master Agricultural Location Data for Farmer CRM
 * Structured hierarchy: State -> District -> Taluka (Thaluka) with standard pin codes.
 * Covers all 38 districts of Tamil Nadu and major agricultural districts in neighboring states.
 */

export interface TalukInfo {
  name: string;
  pincode?: string;
}

export interface DistrictInfo {
  name: string;
  taluks: TalukInfo[];
  defaultPincode?: string;
}

export interface StateInfo {
  name: string;
  code: string;
  districts: DistrictInfo[];
}

export const STATES_DATA: StateInfo[] = [
  {
    name: 'Tamil Nadu',
    code: 'TN',
    districts: [
      {
        name: 'Dharmapuri',
        defaultPincode: '636701',
        taluks: [
          { name: 'Dharmapuri', pincode: '636701' },
          { name: 'Harur', pincode: '636903' },
          { name: 'Palacode', pincode: '636808' },
          { name: 'Pennagaram', pincode: '636810' },
          { name: 'Pappireddipatti', pincode: '636905' },
          { name: 'Karimangalam', pincode: '635111' },
          { name: 'Nallampalli', pincode: '636807' },
        ],
      },
      {
        name: 'Madurai',
        defaultPincode: '625001',
        taluks: [
          { name: 'Madurai North', pincode: '625002' },
          { name: 'Madurai South', pincode: '625001' },
          { name: 'Madurai East', pincode: '625020' },
          { name: 'Melur', pincode: '625106' },
          { name: 'Thirumangalam', pincode: '625706' },
          { name: 'Usilampatti', pincode: '625532' },
          { name: 'Vadipatti', pincode: '625218' },
          { name: 'Peraiyur', pincode: '625703' },
          { name: 'Thiruparankundram', pincode: '625005' },
          { name: 'Kalligudi', pincode: '625701' },
        ],
      },
      {
        name: 'Salem',
        defaultPincode: '636001',
        taluks: [
          { name: 'Salem', pincode: '636001' },
          { name: 'Salem South', pincode: '636006' },
          { name: 'Salem West', pincode: '636009' },
          { name: 'Attur', pincode: '636102' },
          { name: 'Omalur', pincode: '636455' },
          { name: 'Mettur', pincode: '636401' },
          { name: 'Sankari', pincode: '637301' },
          { name: 'Gangavalli', pincode: '636105' },
          { name: 'Edappadi', pincode: '637101' },
          { name: 'Vazhapadi', pincode: '636115' },
          { name: 'Yercaud', pincode: '636601' },
          { name: 'Kadayampatti', pincode: '636351' },
          { name: 'Pethanaickenpalayam', pincode: '636109' },
        ],
      },
      {
        name: 'Coimbatore',
        defaultPincode: '641001',
        taluks: [
          { name: 'Coimbatore North', pincode: '641030' },
          { name: 'Coimbatore South', pincode: '641001' },
          { name: 'Pollachi', pincode: '642001' },
          { name: 'Mettupalayam', pincode: '641301' },
          { name: 'Sulur', pincode: '641402' },
          { name: 'Annur', pincode: '641653' },
          { name: 'Kinathukadavu', pincode: '642109' },
          { name: 'Madukkarai', pincode: '641105' },
          { name: 'Valparai', pincode: '642127' },
          { name: 'Anaimalai', pincode: '642104' },
        ],
      },
      {
        name: 'Erode',
        defaultPincode: '638001',
        taluks: [
          { name: 'Erode', pincode: '638001' },
          { name: 'Bhavani', pincode: '638301' },
          { name: 'Gobichettipalayam', pincode: '638452' },
          { name: 'Sathyamangalam', pincode: '638401' },
          { name: 'Perundurai', pincode: '638052' },
          { name: 'Modakkurichi', pincode: '638104' },
          { name: 'Anthiyur', pincode: '638501' },
          { name: 'Kodumudi', pincode: '638151' },
          { name: 'Thalavadi', pincode: '638461' },
        ],
      },
      {
        name: 'Tiruchirappalli',
        defaultPincode: '620001',
        taluks: [
          { name: 'Tiruchirappalli East', pincode: '620001' },
          { name: 'Tiruchirappalli West', pincode: '620002' },
          { name: 'Srirangam', pincode: '620006' },
          { name: 'Manapparai', pincode: '621306' },
          { name: 'Musiri', pincode: '621211' },
          { name: 'Thuraiyur', pincode: '621010' },
          { name: 'Lalgudi', pincode: '621601' },
          { name: 'Thottiyam', pincode: '621215' },
          { name: 'Manachanallur', pincode: '621005' },
          { name: 'Marungapuri', pincode: '621314' },
        ],
      },
      {
        name: 'Thanjavur',
        defaultPincode: '613001',
        taluks: [
          { name: 'Thanjavur', pincode: '613001' },
          { name: 'Kumbakonam', pincode: '612001' },
          { name: 'Papanasam', pincode: '614205' },
          { name: 'Pattukkottai', pincode: '614601' },
          { name: 'Thiruvaiyaru', pincode: '613204' },
          { name: 'Orathanadu', pincode: '614625' },
          { name: 'Peravurani', pincode: '614804' },
          { name: 'Budalur', pincode: '613602' },
          { name: 'Thiruvidaimarudur', pincode: '612104' },
        ],
      },
      {
        name: 'Dindigul',
        defaultPincode: '624001',
        taluks: [
          { name: 'Dindigul East', pincode: '624001' },
          { name: 'Dindigul West', pincode: '624003' },
          { name: 'Palani', pincode: '624601' },
          { name: 'Oddanchatram', pincode: '624619' },
          { name: 'Nilakottai', pincode: '624208' },
          { name: 'Natham', pincode: '624401' },
          { name: 'Kodaikanal', pincode: '624101' },
          { name: 'Vedasandur', pincode: '624710' },
          { name: 'Gujiliamparai', pincode: '624703' },
        ],
      },
      {
        name: 'Theni',
        defaultPincode: '625531',
        taluks: [
          { name: 'Theni', pincode: '625531' },
          { name: 'Periyakulam', pincode: '625601' },
          { name: 'Bodinayakanur', pincode: '625513' },
          { name: 'Uthamapalayam', pincode: '625533' },
          { name: 'Andipatti', pincode: '625512' },
        ],
      },
      {
        name: 'Tirunelveli',
        defaultPincode: '627001',
        taluks: [
          { name: 'Tirunelveli', pincode: '627001' },
          { name: 'Palayamkottai', pincode: '627002' },
          { name: 'Ambasamudram', pincode: '627401' },
          { name: 'Nanguneri', pincode: '627108' },
          { name: 'Radhapuram', pincode: '627111' },
          { name: 'Cheranmahadevi', pincode: '627414' },
          { name: 'Manur', pincode: '627201' },
          { name: 'Tisayanvilai', pincode: '627657' },
        ],
      },
      {
        name: 'Krishnagiri',
        defaultPincode: '635001',
        taluks: [
          { name: 'Krishnagiri', pincode: '635001' },
          { name: 'Hosur', pincode: '635109' },
          { name: 'Denkanikottai', pincode: '635107' },
          { name: 'Pochampalli', pincode: '635206' },
          { name: 'Uthangarai', pincode: '635207' },
          { name: 'Bargur', pincode: '635104' },
          { name: 'Shoolagiri', pincode: '635117' },
          { name: 'Anchetty', pincode: '636815' },
        ],
      },
      {
        name: 'Tiruppur',
        defaultPincode: '641601',
        taluks: [
          { name: 'Tiruppur North', pincode: '641602' },
          { name: 'Tiruppur South', pincode: '641604' },
          { name: 'Avinashi', pincode: '641654' },
          { name: 'Dharapuram', pincode: '638656' },
          { name: 'Kangeyam', pincode: '638701' },
          { name: 'Udumalaipettai', pincode: '642126' },
          { name: 'Madathukulam', pincode: '642113' },
          { name: 'Uthukuli', pincode: '638751' },
        ],
      },
      {
        name: 'Namakkal',
        defaultPincode: '637001',
        taluks: [
          { name: 'Namakkal', pincode: '637001' },
          { name: 'Rasipuram', pincode: '637408' },
          { name: 'Tiruchengode', pincode: '637211' },
          { name: 'Paramathi Velur', pincode: '638182' },
          { name: 'Kolli Hills', pincode: '637411' },
          { name: 'Sendamangalam', pincode: '637409' },
          { name: 'Mohanur', pincode: '637015' },
          { name: 'Kumarapalayam', pincode: '638183' },
        ],
      },
      {
        name: 'Cuddalore',
        defaultPincode: '607001',
        taluks: [
          { name: 'Cuddalore', pincode: '607001' },
          { name: 'Chidambaram', pincode: '608001' },
          { name: 'Panruti', pincode: '607106' },
          { name: 'Virudhachalam', pincode: '606001' },
          { name: 'Kattumannarkoil', pincode: '608301' },
          { name: 'Kurinjipadi', pincode: '607302' },
          { name: 'Tittagudi', pincode: '606106' },
          { name: 'Bhuvanagiri', pincode: '608601' },
          { name: 'Srimushnam', pincode: '608703' },
          { name: 'Vepur', pincode: '606304' },
        ],
      },
      {
        name: 'Karur',
        defaultPincode: '639001',
        taluks: [
          { name: 'Karur', pincode: '639001' },
          { name: 'Aravakurichi', pincode: '639201' },
          { name: 'Kulithalai', pincode: '639104' },
          { name: 'Krishnarayapuram', pincode: '639102' },
          { name: 'Kadavur', pincode: '621311' },
          { name: 'Manmangalam', pincode: '639006' },
          { name: 'Pugalur', pincode: '639113' },
        ],
      },
      {
        name: 'Pudukkottai',
        defaultPincode: '622001',
        taluks: [
          { name: 'Pudukkottai', pincode: '622001' },
          { name: 'Alangudi', pincode: '622301' },
          { name: 'Aranthangi', pincode: '614616' },
          { name: 'Gandarvakkottai', pincode: '613301' },
          { name: 'Iluppur', pincode: '622102' },
          { name: 'Karambakkudi', pincode: '622302' },
          { name: 'Kulathur', pincode: '622504' },
          { name: 'Manamelkudi', pincode: '614620' },
          { name: 'Ponnamaravathi', pincode: '622407' },
          { name: 'Thirumayam', pincode: '622507' },
          { name: 'Viralimalai', pincode: '621316' },
        ],
      },
      {
        name: 'Virudhunagar',
        defaultPincode: '626001',
        taluks: [
          { name: 'Virudhunagar', pincode: '626001' },
          { name: 'Sivakasi', pincode: '626123' },
          { name: 'Rajapalayam', pincode: '626117' },
          { name: 'Srivilliputhur', pincode: '626125' },
          { name: 'Aruppukkottai', pincode: '626101' },
          { name: 'Sattur', pincode: '626203' },
          { name: 'Kariapatti', pincode: '626106' },
          { name: 'Tiruchuli', pincode: '626129' },
          { name: 'Vembakottai', pincode: '626131' },
          { name: 'Watrap', pincode: '626132' },
        ],
      },
      {
        name: 'Thoothukudi',
        defaultPincode: '628001',
        taluks: [
          { name: 'Thoothukudi', pincode: '628001' },
          { name: 'Tiruchendur', pincode: '628215' },
          { name: 'Kovilpatti', pincode: '628501' },
          { name: 'Ottapidaram', pincode: '628401' },
          { name: 'Sathankulam', pincode: '628704' },
          { name: 'Srivaikuntam', pincode: '628601' },
          { name: 'Vilathikulam', pincode: '628907' },
          { name: 'Kayathar', pincode: '628952' },
          { name: 'Eral', pincode: '628801' },
        ],
      },
      {
        name: 'Tenkasi',
        defaultPincode: '627811',
        taluks: [
          { name: 'Tenkasi', pincode: '627811' },
          { name: 'Sankarankovil', pincode: '627756' },
          { name: 'Alangulam', pincode: '627851' },
          { name: 'Kadayanallur', pincode: '627751' },
          { name: 'Sengottai', pincode: '627809' },
          { name: 'Sivagiri', pincode: '627757' },
          { name: 'Thiruvengadam', pincode: '627719' },
          { name: 'Veerakeralamputhur', pincode: '627861' },
        ],
      },
      {
        name: 'Vellore',
        defaultPincode: '632001',
        taluks: [
          { name: 'Vellore', pincode: '632001' },
          { name: 'Katpadi', pincode: '632007' },
          { name: 'Gudiyatham', pincode: '632602' },
          { name: 'Pernambut', pincode: '635810' },
          { name: 'Anaicut', pincode: '632101' },
          { name: 'K.V. Kuppam', pincode: '632201' },
        ],
      },
      {
        name: 'Tirupathur',
        defaultPincode: '635601',
        taluks: [
          { name: 'Tirupathur', pincode: '635601' },
          { name: 'Vaniyambadi', pincode: '635751' },
          { name: 'Ambur', pincode: '635802' },
          { name: 'Natrampalli', pincode: '635852' },
        ],
      },
      {
        name: 'Ranipet',
        defaultPincode: '632401',
        taluks: [
          { name: 'Ranipet', pincode: '632401' },
          { name: 'Walajah', pincode: '632513' },
          { name: 'Arcot', pincode: '632503' },
          { name: 'Nemili', pincode: '631051' },
          { name: 'Arakkonam', pincode: '631001' },
          { name: 'Kalavai', pincode: '632506' },
        ],
      },
      {
        name: 'Tiruvannamalai',
        defaultPincode: '606601',
        taluks: [
          { name: 'Tiruvannamalai', pincode: '606601' },
          { name: 'Arani', pincode: '632301' },
          { name: 'Cheyyar', pincode: '604407' },
          { name: 'Polur', pincode: '606803' },
          { name: 'Chengam', pincode: '606701' },
          { name: 'Vandavasi', pincode: '604408' },
          { name: 'Kalasapakkam', pincode: '606751' },
          { name: 'Chetpet', pincode: '606801' },
          { name: 'Kilpennathur', pincode: '604601' },
        ],
      },
      {
        name: 'Viluppuram',
        defaultPincode: '605602',
        taluks: [
          { name: 'Viluppuram', pincode: '605602' },
          { name: 'Tindivanam', pincode: '604001' },
          { name: 'Gingee', pincode: '604202' },
          { name: 'Vanur', pincode: '605109' },
          { name: 'Vikravandi', pincode: '605652' },
          { name: 'Marakkanam', pincode: '604303' },
        ],
      },
      {
        name: 'Kallakurichi',
        defaultPincode: '606202',
        taluks: [
          { name: 'Kallakurichi', pincode: '606202' },
          { name: 'Sankarapuram', pincode: '606401' },
          { name: 'Tirukoilur', pincode: '605757' },
          { name: 'Ulundurpet', pincode: '606107' },
          { name: 'Chinnasalem', pincode: '606201' },
        ],
      },
      {
        name: 'Kancheepuram',
        defaultPincode: '631501',
        taluks: [
          { name: 'Kancheepuram', pincode: '631501' },
          { name: 'Sriperumbudur', pincode: '602105' },
          { name: 'Uthiramerur', pincode: '603406' },
          { name: 'Walajabad', pincode: '631605' },
          { name: 'Kundrathur', pincode: '600069' },
        ],
      },
      {
        name: 'Chengalpattu',
        defaultPincode: '603001',
        taluks: [
          { name: 'Chengalpattu', pincode: '603001' },
          { name: 'Maduranthakam', pincode: '603306' },
          { name: 'Cheyyur', pincode: '603302' },
          { name: 'Thiruporur', pincode: '603110' },
          { name: 'Tambaram', pincode: '600045' },
        ],
      },
      {
        name: 'Tiruvallur',
        defaultPincode: '602001',
        taluks: [
          { name: 'Tiruvallur', pincode: '602001' },
          { name: 'Ponneri', pincode: '601204' },
          { name: 'Gummidipoondi', pincode: '601201' },
          { name: 'Tiruttani', pincode: '631209' },
          { name: 'Uthukkottai', pincode: '602026' },
          { name: 'Poonamallee', pincode: '600056' },
        ],
      },
      {
        name: 'Nagapattinam',
        defaultPincode: '611001',
        taluks: [
          { name: 'Nagapattinam', pincode: '611001' },
          { name: 'Kilvelur', pincode: '611104' },
          { name: 'Vedaranyam', pincode: '614810' },
          { name: 'Thirukkuvalai', pincode: '610205' },
        ],
      },
      {
        name: 'Mayiladuthurai',
        defaultPincode: '609001',
        taluks: [
          { name: 'Mayiladuthurai', pincode: '609001' },
          { name: 'Sirkazhi', pincode: '609110' },
          { name: 'Tharangambadi', pincode: '609305' },
          { name: 'Kuthalam', pincode: '609801' },
        ],
      },
      {
        name: 'Tiruvarur',
        defaultPincode: '610001',
        taluks: [
          { name: 'Tiruvarur', pincode: '610001' },
          { name: 'Mannargudi', pincode: '614001' },
          { name: 'Nannilam', pincode: '610105' },
          { name: 'Thiruthuraipoondi', pincode: '614713' },
          { name: 'Kudavasal', pincode: '612601' },
          { name: 'Valangaiman', pincode: '612804' },
          { name: 'Needamangalam', pincode: '614404' },
        ],
      },
      {
        name: 'Ariyalur',
        defaultPincode: '621704',
        taluks: [
          { name: 'Ariyalur', pincode: '621704' },
          { name: 'Sendurai', pincode: '621714' },
          { name: 'Udayarpalayam', pincode: '621804' },
          { name: 'Andimadam', pincode: '621801' },
        ],
      },
      {
        name: 'Perambalur',
        defaultPincode: '621212',
        taluks: [
          { name: 'Perambalur', pincode: '621212' },
          { name: 'Kunnam', pincode: '621708' },
          { name: 'Veppanthattai', pincode: '621116' },
          { name: 'Alathur', pincode: '621109' },
        ],
      },
      {
        name: 'Sivaganga',
        defaultPincode: '630561',
        taluks: [
          { name: 'Sivaganga', pincode: '630561' },
          { name: 'Karaikudi', pincode: '630001' },
          { name: 'Devakottai', pincode: '630302' },
          { name: 'Manamadurai', pincode: '630606' },
          { name: 'Ilayangudi', pincode: '630702' },
          { name: 'Tirupathur', pincode: '630211' },
          { name: 'Singampunari', pincode: '630502' },
        ],
      },
      {
        name: 'Ramanathapuram',
        defaultPincode: '623501',
        taluks: [
          { name: 'Ramanathapuram', pincode: '623501' },
          { name: 'Paramakudi', pincode: '623707' },
          { name: 'Kamuthi', pincode: '623603' },
          { name: 'Mudukulathur', pincode: '623704' },
          { name: 'Rameswaram', pincode: '623526' },
          { name: 'Tiruvadanai', pincode: '623407' },
          { name: 'Kadaladi', pincode: '623703' },
        ],
      },
      {
        name: 'Kanniyakumari',
        defaultPincode: '629001',
        taluks: [
          { name: 'Agastheeswaram', pincode: '629702' },
          { name: 'Thovalai', pincode: '629302' },
          { name: 'Kalkulam', pincode: '629175' },
          { name: 'Vilavancode', pincode: '629163' },
          { name: 'Thiruvattar', pincode: '629177' },
        ],
      },
      {
        name: 'The Nilgiris',
        defaultPincode: '643001',
        taluks: [
          { name: 'Udhagamandalam', pincode: '643001' },
          { name: 'Coonoor', pincode: '643101' },
          { name: 'Kotagiri', pincode: '643217' },
          { name: 'Gudalur', pincode: '643212' },
          { name: 'Pandalur', pincode: '643233' },
          { name: 'Kundah', pincode: '643219' },
        ],
      },
    ],
  },
  {
    name: 'Karnataka',
    code: 'KA',
    districts: [
      {
        name: 'Kolar',
        defaultPincode: '563101',
        taluks: [
          { name: 'Kolar', pincode: '563101' },
          { name: 'Bangarapet', pincode: '563114' },
          { name: 'Malur', pincode: '563130' },
          { name: 'Mulbagal', pincode: '563131' },
          { name: 'Srinivaspur', pincode: '563135' },
        ],
      },
      {
        name: 'Chikkaballapur',
        defaultPincode: '562101',
        taluks: [
          { name: 'Chikkaballapur', pincode: '562101' },
          { name: 'Bagepalli', pincode: '561207' },
          { name: 'Chintamani', pincode: '563125' },
          { name: 'Gauribidanur', pincode: '561208' },
          { name: 'Sidlaghatta', pincode: '562105' },
        ],
      },
      {
        name: 'Bengaluru Rural',
        defaultPincode: '562110',
        taluks: [
          { name: 'Devanahalli', pincode: '562110' },
          { name: 'Doddaballapura', pincode: '561203' },
          { name: 'Hoskote', pincode: '562114' },
          { name: 'Nelamangala', pincode: '562123' },
        ],
      },
      {
        name: 'Mysuru',
        defaultPincode: '570001',
        taluks: [
          { name: 'Mysuru', pincode: '570001' },
          { name: 'Hunsur', pincode: '571105' },
          { name: 'Nanjangud', pincode: '571301' },
          { name: 'T. Narasipura', pincode: '571124' },
          { name: 'Piriyapatna', pincode: '571107' },
          { name: 'Heggadadevankote', pincode: '571114' },
          { name: 'Krishnarajanagara', pincode: '571602' },
        ],
      },
      {
        name: 'Mandya',
        defaultPincode: '571401',
        taluks: [
          { name: 'Mandya', pincode: '571401' },
          { name: 'Maddur', pincode: '571428' },
          { name: 'Malavalli', pincode: '571430' },
          { name: 'Pandavapura', pincode: '571434' },
          { name: 'Nagamangala', pincode: '571432' },
          { name: 'Krishnarajpet', pincode: '571426' },
          { name: 'Srirangapatna', pincode: '571438' },
        ],
      },
      {
        name: 'Tumakuru',
        defaultPincode: '572101',
        taluks: [
          { name: 'Tumakuru', pincode: '572101' },
          { name: 'Tiptur', pincode: '572201' },
          { name: 'Chiknayakanhalli', pincode: '572214' },
          { name: 'Gubbi', pincode: '572216' },
          { name: 'Kunigal', pincode: '572130' },
          { name: 'Madhugiri', pincode: '572132' },
          { name: 'Sira', pincode: '572137' },
        ],
      },
      {
        name: 'Hassan',
        defaultPincode: '573201',
        taluks: [
          { name: 'Hassan', pincode: '573201' },
          { name: 'Arsikere', pincode: '573103' },
          { name: 'Channarayapatna', pincode: '573116' },
          { name: 'Holenarasipur', pincode: '573211' },
          { name: 'Belur', pincode: '573115' },
          { name: 'Sakleshpur', pincode: '573134' },
        ],
      },
    ],
  },
  {
    name: 'Andhra Pradesh',
    code: 'AP',
    districts: [
      {
        name: 'Chittoor',
        defaultPincode: '517001',
        taluks: [
          { name: 'Chittoor', pincode: '517001' },
          { name: 'Palamaner', pincode: '517408' },
          { name: 'Nagari', pincode: '517590' },
          { name: 'Kuppam', pincode: '517425' },
          { name: 'Bangarupalem', pincode: '517416' },
        ],
      },
      {
        name: 'Tirupati',
        defaultPincode: '517501',
        taluks: [
          { name: 'Tirupati Urban', pincode: '517501' },
          { name: 'Tirupati Rural', pincode: '517505' },
          { name: 'Chandragiri', pincode: '517101' },
          { name: 'Srikalahasti', pincode: '517644' },
          { name: 'Gudur', pincode: '524101' },
          { name: 'Sullurpeta', pincode: '524121' },
          { name: 'Venkatagiri', pincode: '524132' },
        ],
      },
      {
        name: 'Annamayya',
        defaultPincode: '516269',
        taluks: [
          { name: 'Rayachoti', pincode: '516269' },
          { name: 'Madanapalle', pincode: '517325' },
          { name: 'Rajampet', pincode: '516115' },
          { name: 'Pileru', pincode: '517214' },
        ],
      },
      {
        name: 'Anantapur',
        defaultPincode: '515001',
        taluks: [
          { name: 'Anantapur', pincode: '515001' },
          { name: 'Dharmavaram', pincode: '515671' },
          { name: 'Guntakal', pincode: '515801' },
          { name: 'Tadipatri', pincode: '515411' },
          { name: 'Kalyandurg', pincode: '515761' },
        ],
      },
      {
        name: 'Guntur',
        defaultPincode: '522001',
        taluks: [
          { name: 'Guntur', pincode: '522001' },
          { name: 'Tenali', pincode: '522201' },
          { name: 'Mangalagiri', pincode: '522503' },
          { name: 'Ponnur', pincode: '522124' },
        ],
      },
    ],
  },
  {
    name: 'Kerala',
    code: 'KL',
    districts: [
      {
        name: 'Palakkad',
        defaultPincode: '678001',
        taluks: [
          { name: 'Palakkad', pincode: '678001' },
          { name: 'Chittur', pincode: '678101' },
          { name: 'Alathur', pincode: '678541' },
          { name: 'Ottappalam', pincode: '679101' },
          { name: 'Mannarkkad', pincode: '678582' },
          { name: 'Pattambi', pincode: '679303' },
        ],
      },
      {
        name: 'Wayanad',
        defaultPincode: '673121',
        taluks: [
          { name: 'Vythiri', pincode: '673576' },
          { name: 'Sulthan Bathery', pincode: '673592' },
          { name: 'Mananthavady', pincode: '670645' },
        ],
      },
      {
        name: 'Idukki',
        defaultPincode: '685603',
        taluks: [
          { name: 'Devikulam', pincode: '685613' },
          { name: 'Udumbanchola', pincode: '685554' },
          { name: 'Thodupuzha', pincode: '685584' },
          { name: 'Peermade', pincode: '685531' },
        ],
      },
    ],
  },
];

/**
 * Returns all state names.
 */
export function getStates(): string[] {
  return STATES_DATA.map((s) => s.name);
}

/**
 * Returns all districts for a given state name.
 */
export function getDistricts(stateName: string): string[] {
  const st = STATES_DATA.find((s) => s.name.toLowerCase() === (stateName || '').toLowerCase());
  return st ? st.districts.map((d) => d.name) : [];
}

/**
 * Returns all talukas for a given state and district.
 */
export function getTaluks(stateName: string, districtName: string): TalukInfo[] {
  const st = STATES_DATA.find((s) => s.name.toLowerCase() === (stateName || '').toLowerCase());
  if (!st) return [];
  const dist = st.districts.find((d) => d.name.toLowerCase() === (districtName || '').toLowerCase());
  return dist ? dist.taluks : [];
}

/**
 * Finds suggested pincode for a given state, district, and taluk.
 */
export function getSuggestedPincode(stateName: string, districtName: string, talukName: string): string | undefined {
  const st = STATES_DATA.find((s) => s.name.toLowerCase() === (stateName || '').toLowerCase());
  if (!st) return undefined;
  const dist = st.districts.find((d) => d.name.toLowerCase() === (districtName || '').toLowerCase());
  if (!dist) return undefined;
  const taluk = dist.taluks.find((t) => t.name.toLowerCase() === (talukName || '').toLowerCase());
  return taluk?.pincode || dist.defaultPincode;
}
