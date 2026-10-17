import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, X, MapPin, Sprout, Globe, UserCheck, Layers, HelpCircle, Phone } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { CustomerDetail } from '../../lib/types';
import { Alert, Button, Card, Field, Input, Select, cx } from '../../components/ui';
import { duplicateMatch } from './CustomersPage';
import { LocationSelector } from '../../components/LocationSelector';

interface PhoneRow {
  key: number;
  number: string;
  kind: 'MOBILE' | 'OTHER';
  isPrimary: boolean;
}

interface CropOption {
  id: string;
  code: string;
  name: string;
}

interface SoilTypeOption {
  id: string;
  code: string;
  nameEn: string;
  nameTa: string;
}

const LANGUAGE_OPTIONS = [
  { code: 'ta', label: 'Tamil — தமிழ்' },
  { code: 'en', label: 'English' },
  { code: 'te', label: 'Telugu — తెలుగు' },
  { code: 'kn', label: 'Kannada — ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam — മലയാളം' },
];

let nextKey = 1;

export function NewCustomerModal({
  onClose,
  onCreated,
  initialPhone,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  /** Pre-fill the dialed number (mid-call creation from the Agent workspace). */
  initialPhone?: string;
}) {
  const [fullName, setFullName] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('ta');
  const [soilType, setSoilType] = useState('Red Soil');
  const [customSoil, setCustomSoil] = useState('');
  const [soilTypes, setSoilTypes] = useState<SoilTypeOption[]>([]);
  const [phones, setPhones] = useState<PhoneRow[]>([{ key: nextKey++, number: initialPhone ?? '', kind: 'MOBILE', isPrimary: true }]);

  // Farm Location fields (defaulting to Tamil Nadu / Dharmapuri agricultural zone)
  const [village, setVillage] = useState('');
  const [taluk, setTaluk] = useState('Dharmapuri');
  const [district, setDistrict] = useState('Dharmapuri');
  const [state, setState] = useState('Tamil Nadu');
  const [pincode, setPincode] = useState('636701');

  // Crop & Agricultural fields
  const [availableCrops, setAvailableCrops] = useState<CropOption[]>([]);
  const [cropId, setCropId] = useState('');
  const [acreage, setAcreage] = useState('');
  const [cropStage, setCropStage] = useState('Sowing / Germination');
  const [cropSeason, setCropSeason] = useState('Kharif / Samba');
  const [cropNotes, setCropNotes] = useState('');

  // Referral Information
  const [referralSource, setReferralSource] = useState('Direct Inbound Call');
  const [referrerPhoneOrCode, setReferrerPhoneOrCode] = useState('');
  const [referralNotes, setReferralNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<{ id: string; fullName: string; phone: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Load Crops catalogue
    api
      .get<CropOption[]>('/crops')
      .then((res) => {
        if (!cancelled && res.data) {
          setAvailableCrops(res.data);
          if (res.data.length > 0) {
            const defaultCrop = res.data.find((c) => c.code === 'RICE') || res.data[0];
            setCropId(defaultCrop.id);
          }
        }
      })
      .catch(() => undefined);

    // Load Bilingual Soils master catalogue
    api
      .get<SoilTypeOption[]>('/soil-types')
      .then((res) => {
        if (!cancelled && Array.isArray(res.data) && res.data.length > 0) {
          setSoilTypes(res.data);
          const defaultSoil = res.data.find((s) => s.code === 'RED') || res.data[0];
          setSoilType(defaultSoil.nameEn);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  function updatePhone(key: number, patch: Partial<PhoneRow>) {
    setPhones((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    if (patch.isPrimary) {
      setPhones((rows) => rows.map((row) => (row.key === key ? { ...row, isPrimary: true } : { ...row, isPrimary: false })));
    }
  }

  const valid = fullName.trim().length >= 2 && phones.length > 0 && phones.every((p) => p.number.trim().length > 0);

  async function submit() {
    setBusy(true);
    setError(null);
    setMatch(null);
    try {
      const finalSoil = soilType === 'CUSTOM' ? customSoil.trim() : soilType;
      const payload: any = {
        fullName: fullName.trim(),
        preferredLanguage,
        soilType: finalSoil || null,
        phones: { phones: phones.map((p) => ({ number: p.number.trim(), kind: p.kind, isPrimary: p.isPrimary })) },
      };

      if (village.trim() || taluk.trim() || district.trim() || state.trim() || pincode.trim()) {
        payload.locations = {
          locations: [
            {
              village: village.trim() || undefined,
              taluk: taluk.trim() || undefined,
              district: district.trim() || undefined,
              state: state.trim() || undefined,
              pincode: pincode.trim() || undefined,
              isPrimary: true,
            },
          ],
        };
      }

      if (cropId && acreage.trim()) {
        const parsedAcreage = parseFloat(acreage.trim());
        if (!isNaN(parsedAcreage) && parsedAcreage > 0) {
          const combinedNotes = [
            cropStage ? `Stage: ${cropStage}` : '',
            cropSeason ? `Season: ${cropSeason}` : '',
            cropNotes.trim(),
          ]
            .filter(Boolean)
            .join(' | ');

          payload.crops = {
            crops: [
              {
                cropId,
                acreage: parsedAcreage,
                unit: 'ACRES',
                notes: combinedNotes || undefined,
              },
            ],
          };
        }
      }

      const res = await api.post<CustomerDetail>('/customers', payload);
      const newCustomerId = res.data.id;

      // If referral details are provided, record an initial referral note
      if (referrerPhoneOrCode.trim() || referralNotes.trim()) {
        try {
          const noteBody = `[REFERRAL SOURCE] ${referralSource}${
            referrerPhoneOrCode.trim() ? ` | Referred by: ${referrerPhoneOrCode.trim()}` : ''
          }${referralNotes.trim() ? ` — Notes: ${referralNotes.trim()}` : ''}`;
          await api.post(`/customers/${newCustomerId}/notes`, { body: noteBody });
        } catch {
          // Non-blocking note recording
        }
      }

      onCreated(newCustomerId);
    } catch (err) {
      const matched = duplicateMatch(err);
      if (matched) {
        setMatch({ id: matched.id, fullName: matched.fullName, phone: matched.phone });
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs" role="dialog" aria-modal="true">
      <Card className="max-h-[92vh] w-full max-w-xl overflow-hidden flex flex-col shadow-2xl border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/75">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              Add New Farmer Profile
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Register a verified farmer record with agricultural profile & contacts.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {match ? (
            <Alert tone="info">
              <p className="font-semibold text-blue-900">Duplicate Phone Detected:</p>
              <p className="text-xs text-blue-800 mt-0.5">
                This number already belongs to <span className="font-bold">{match.fullName}</span> ({match.phone}).
              </p>
              <Link
                to={`/customers/${match.id}`}
                onClick={onClose}
                className="mt-2 inline-flex items-center gap-1 font-semibold text-xs text-brand-700 hover:text-brand-800 underline"
              >
                Open Existing Farmer Profile &rarr;
              </Link>
            </Alert>
          ) : null}

          {/* Section 1: Farmer Identity & Spoken Language */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-brand-600" />
                <span>Farmer Identity & Preferences</span>
              </span>
              <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                Primary Profile
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Farmer Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  autoFocus
                  className="font-medium"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Globe className="h-3 w-3 text-slate-500" /> Preferred Spoken Language
                </label>
                <Select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full text-xs font-medium"
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Section 2: Verified Phone Numbers */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                <span>Contact Phone Numbers</span>
              </span>
              <span className="text-[10px] text-slate-500">First number is dialed by default</span>
            </div>

            <div className="space-y-2">
              {phones.map((phone) => (
                <div
                  key={phone.key}
                  className={cx(
                    'flex items-center gap-2 rounded-lg border p-2 transition',
                    phone.isPrimary ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200 bg-slate-50/50'
                  )}
                >
                  <Input
                    className="flex-1 min-w-0 font-medium text-slate-900 bg-white text-xs"
                    inputMode="tel"
                    placeholder="Mobile number (e.g. 9840012345)"
                    value={phone.number}
                    onChange={(e) => updatePhone(phone.key, { number: e.target.value })}
                  />
                  <Select
                    className="w-24 shrink-0 text-slate-800 font-medium text-xs"
                    value={phone.kind}
                    onChange={(e) => updatePhone(phone.key, { kind: e.target.value as 'MOBILE' | 'OTHER' })}
                    aria-label="Phone kind"
                  >
                    <option value="MOBILE">Mobile</option>
                    <option value="OTHER">Other</option>
                  </Select>
                  <button
                    type="button"
                    onClick={() => updatePhone(phone.key, { isPrimary: true })}
                    title="Set primary"
                    className={cx(
                      'shrink-0 rounded-md px-2 py-1 text-[11px] font-bold transition cursor-pointer',
                      phone.isPrimary ? 'bg-brand-600 text-white shadow-2xs' : 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                    )}
                  >
                    {phone.isPrimary ? 'Primary' : 'Set Primary'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhones((rows) => rows.filter((row) => row.key !== phone.key))}
                    disabled={phones.length === 1}
                    className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                    aria-label="Remove phone"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPhones((rows) => [...rows, { key: nextKey++, number: '', kind: 'MOBILE', isPrimary: false }])}
                className="text-xs"
              >
                + Add another number
              </Button>
            </div>
          </div>

          {/* Section 3: Farm Soil Catalogue */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-amber-600" />
                <span>Soil Classification</span>
              </span>
              <span className="text-[10px] text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Bilingual Catalogue
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Soil Type</label>
                <Select
                  value={soilType}
                  onChange={(e) => setSoilType(e.target.value)}
                  className="w-full text-xs font-medium"
                >
                  {soilTypes.length > 0 ? (
                    soilTypes.map((s) => (
                      <option key={s.id} value={s.nameEn}>
                        {s.nameEn} — {s.nameTa}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Red Soil">Red Soil — செம்மண்</option>
                      <option value="Clay Soil">Clay Soil — களிமண்</option>
                      <option value="Sandy Soil">Sandy Soil — மணல் மண்</option>
                      <option value="Loamy Soil">Loamy Soil — வண்டல் கலந்த மண்</option>
                      <option value="Black Soil">Black Soil — கரிசல் மண்</option>
                      <option value="Alluvial Soil">Alluvial Soil — வண்டல் மண்</option>
                      <option value="Gravelly Soil">Gravelly Soil — சரளை மண்</option>
                    </>
                  )}
                  <option value="CUSTOM">Other / Specific description...</option>
                </Select>
              </div>

              {soilType === 'CUSTOM' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Specify Soil Details</label>
                  <Input
                    value={customSoil}
                    onChange={(e) => setCustomSoil(e.target.value)}
                    placeholder="e.g. Calcareous red loam"
                    maxLength={40}
                    className="text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Farm Location / Zone */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                <span>Farm Location / Administrative Zone</span>
              </div>
              <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Official Revenue Hierarchy
              </span>
            </div>

            <LocationSelector
              state={state}
              district={district}
              taluk={taluk}
              village={village}
              pincode={pincode}
              onChange={(patch) => {
                if (patch.state !== undefined) setState(patch.state);
                if (patch.district !== undefined) setDistrict(patch.district);
                if (patch.taluk !== undefined) setTaluk(patch.taluk);
                if (patch.village !== undefined) setVillage(patch.village);
                if (patch.pincode !== undefined) setPincode(patch.pincode);
              }}
            />
          </div>

          {/* Section 5: Cultivating Crop Details */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-950">
                <Sprout className="h-3.5 w-3.5 text-emerald-700" />
                <span>Primary Cultivating Crop</span>
              </span>
              <span className="text-[10px] text-emerald-800 font-medium">Multi-season supported</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Crop</label>
                <Select
                  value={cropId}
                  onChange={(e) => setCropId(e.target.value)}
                  className="w-full text-xs font-medium"
                >
                  <option value="">Select crop...</option>
                  {availableCrops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cultivated Acreage</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={acreage}
                  onChange={(e) => setAcreage(e.target.value)}
                  placeholder="e.g. 3.5"
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Crop Stage</label>
                <Select
                  value={cropStage}
                  onChange={(e) => setCropStage(e.target.value)}
                  className="w-full text-xs font-medium"
                >
                  <option value="Sowing / Germination">Sowing / Germination</option>
                  <option value="Vegetative / Tillering">Vegetative / Tillering</option>
                  <option value="Flowering / Budding">Flowering / Budding</option>
                  <option value="Fruiting / Grain Filling">Fruiting / Grain Filling</option>
                  <option value="Maturity / Harvest Ready">Maturity / Harvest Ready</option>
                  <option value="Post-Harvest">Post-Harvest</option>
                </Select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cultivation Notes / Variety</label>
                <Input
                  value={cropNotes}
                  onChange={(e) => setCropNotes(e.target.value)}
                  placeholder="e.g. Variety: BPT 5204 (Samba cycle), drip irrigation installed"
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 6: Referral Source & Relationship */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-indigo-600" />
                <span>Referral Information</span>
              </span>
              <span className="text-[10px] text-slate-500">Optional</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Referral Source</label>
                <Select
                  value={referralSource}
                  onChange={(e) => setReferralSource(e.target.value)}
                  className="w-full text-xs font-medium"
                >
                  <option value="Direct Inbound Call">Direct Inbound Call</option>
                  <option value="Referred by Existing Farmer">Referred by Existing Farmer</option>
                  <option value="Field Demonstration Camp">Field Demonstration Camp</option>
                  <option value="Agri Dealer / Sub-dealer">Agri Dealer / Sub-dealer</option>
                  <option value="WhatsApp / Social Media">WhatsApp / Social Media</option>
                  <option value="Other">Other</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Referring Farmer Code / Phone</label>
                <Input
                  value={referrerPhoneOrCode}
                  onChange={(e) => setReferrerPhoneOrCode(e.target.value)}
                  placeholder="e.g. FMR-00104 or 9840012345"
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-6 py-3.5 bg-slate-50/75">
          <Button variant="ghost" onClick={onClose} className="text-xs font-medium">
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!valid || busy}
            className="px-5 py-2 text-xs font-semibold shadow-xs"
          >
            {busy ? 'Registering Farmer...' : 'Save & Register Farmer'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
