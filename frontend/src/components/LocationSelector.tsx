import { useEffect, useMemo, useState } from 'react';
import {
  getStates,
  getDistricts,
  getTaluks,
  getVillages,
  getSuggestedPincode,
  canonicalDistrict,
} from '../lib/location-data';
import { Field, Input, Select } from './ui';

export interface LocationSelectorProps {
  state: string;
  district: string;
  taluk: string;
  village: string;
  pincode: string;
  onChange: (patch: {
    state?: string;
    district?: string;
    taluk?: string;
    village?: string;
    pincode?: string;
  }) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function LocationSelector({
  state,
  district,
  taluk,
  village,
  pincode,
  onChange,
  disabled = false,
  compact = false,
}: LocationSelectorProps) {
  const [customDistrict, setCustomDistrict] = useState(false);
  const [customTaluk, setCustomTaluk] = useState(false);
  const [customVillage, setCustomVillage] = useState(false);
  const [availableVillages, setAvailableVillages] = useState<string[]>([]);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [villageSearch, setVillageSearch] = useState('');

  const availableStates = useMemo(() => getStates(), []);
  const availableDistricts = useMemo(() => getDistricts(state), [state]);
  const availableTaluks = useMemo(() => getTaluks(state, district), [state, district]);

  // Canonical spelling of the current district (older records may use aliases like "Tiruvallur")
  const districtValue = useMemo(() => canonicalDistrict(state, district) ?? district, [state, district]);
  const isDistrictInList = !district || Boolean(canonicalDistrict(state, district));

  useEffect(() => {
    let cancelled = false;
    if (!taluk) {
      setAvailableVillages([]);
      setLoadingVillages(false);
      return;
    }
    setLoadingVillages(true);
    setVillageSearch('');
    getVillages(state, district, taluk)
      .then((list) => {
        if (!cancelled) {
          setAvailableVillages(list);
          setLoadingVillages(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableVillages([]);
          setLoadingVillages(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state, district, taluk]);

  const isVillageInList = Boolean(village) && availableVillages.some((v) => v.toLowerCase() === village.toLowerCase());

  // Check if current taluk is in master list
  const isTalukInList = useMemo(() => {
    if (!taluk) return true;
    return availableTaluks.some((t) => t.name.toLowerCase() === taluk.toLowerCase());
  }, [taluk, availableTaluks]);

  const showCustomDistrictInput = customDistrict || (!isDistrictInList && Boolean(district));
  const showCustomTalukInput = customTaluk || (!isTalukInList && Boolean(taluk));
  const showCustomVillageInput = customVillage || (Boolean(taluk) && !loadingVillages && availableVillages.length === 0);

  const filteredVillages = useMemo(() => {
    if (!villageSearch.trim()) return availableVillages;
    const term = villageSearch.trim().toLowerCase();
    return availableVillages.filter((v) => v.toLowerCase().includes(term));
  }, [availableVillages, villageSearch]);

  function handleStateChange(newState: string) {
    const nextDistricts = getDistricts(newState);
    const newDistrict = nextDistricts[0] || '';
    const nextTaluks = getTaluks(newState, newDistrict);
    const newTaluk = nextTaluks[0]?.name || '';
    const suggestedPin = getSuggestedPincode(newState, newDistrict, newTaluk) || '';

    setCustomDistrict(false);
    setCustomTaluk(false);
    setCustomVillage(false);

    onChange({
      state: newState,
      district: newDistrict,
      taluk: newTaluk,
      village: '',
      pincode: suggestedPin,
    });
  }

  function handleDistrictChange(newDistrict: string) {
    if (newDistrict === '__CUSTOM__') {
      setCustomDistrict(true);
      onChange({ district: '', taluk: '', village: '' });
      return;
    }
    setCustomDistrict(false);
    setCustomTaluk(false);
    setCustomVillage(false);

    const nextTaluks = getTaluks(state, newDistrict);
    const newTaluk = nextTaluks[0]?.name || '';
    const suggestedPin = getSuggestedPincode(state, newDistrict, newTaluk) || '';

    onChange({
      district: newDistrict,
      taluk: newTaluk,
      village: '',
      pincode: suggestedPin || pincode,
    });
  }

  function handleTalukChange(newTaluk: string) {
    if (newTaluk === '__CUSTOM__') {
      setCustomTaluk(true);
      onChange({ taluk: '', village: '' });
      return;
    }
    setCustomTaluk(false);
    setCustomVillage(false);
    const suggestedPin = getSuggestedPincode(state, district, newTaluk);
    onChange({
      taluk: newTaluk,
      village: '',
      pincode: suggestedPin || pincode,
    });
  }

  function handleVillageChange(newVillage: string) {
    if (newVillage === '__CUSTOM__') {
      setCustomVillage(true);
      onChange({ village: '' });
      return;
    }
    setCustomVillage(false);
    onChange({ village: newVillage });
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {/* State & District Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="State / Region">
          <Select
            value={state || 'Tamil Nadu'}
            onChange={(e) => handleStateChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-white text-xs font-medium"
          >
            {availableStates.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="District">
          {showCustomDistrictInput ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={district}
                onChange={(e) => onChange({ district: e.target.value })}
                placeholder="Type District Name"
                disabled={disabled}
                className="flex-1 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  setCustomDistrict(false);
                  onChange({ district: availableDistricts[0] || '' });
                }}
                className="shrink-0 text-[11px] text-emerald-700 font-semibold underline px-1"
              >
                List
              </button>
            </div>
          ) : (
            <Select
              value={districtValue}
              onChange={(e) => handleDistrictChange(e.target.value)}
              disabled={disabled}
              className="w-full bg-white text-xs font-medium"
            >
              <option value="">-- Select District --</option>
              {availableDistricts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value="__CUSTOM__">✏️ Other (Type manually)...</option>
            </Select>
          )}
        </Field>
      </div>

      {/* Taluk / Thaluka & Village Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Taluka / Block">
          {showCustomTalukInput || availableTaluks.length === 0 ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={taluk}
                onChange={(e) => onChange({ taluk: e.target.value })}
                placeholder="Type Taluk / Block"
                disabled={disabled}
                className="flex-1 text-xs"
              />
              {availableTaluks.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomTaluk(false);
                    onChange({ taluk: availableTaluks[0]?.name || '' });
                  }}
                  className="shrink-0 text-[11px] text-emerald-700 font-semibold underline px-1"
                >
                  List
                </button>
              )}
            </div>
          ) : (
            <Select
              value={taluk}
              onChange={(e) => handleTalukChange(e.target.value)}
              disabled={disabled || !district}
              className="w-full bg-white text-xs font-medium"
            >
              <option value="">-- Select Taluka / Block --</option>
              {availableTaluks.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} {t.pincode ? `(${t.pincode})` : ''}
                </option>
              ))}
              <option value="__CUSTOM__">✏️ Other (Type manually)...</option>
            </Select>
          )}
        </Field>

        <Field label="Village / Area">
          {!taluk ? (
            <Select disabled value="" className="w-full bg-slate-50 text-slate-400 text-xs font-medium">
              <option value="">-- Select Taluka / Block first --</option>
            </Select>
          ) : loadingVillages ? (
            <Select disabled value="" className="w-full bg-slate-50 text-slate-500 text-xs font-medium">
              <option value="">⏳ Loading villages in {taluk}...</option>
            </Select>
          ) : showCustomVillageInput ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={village}
                onChange={(e) => onChange({ village: e.target.value })}
                placeholder="e.g. Melakkal, Papanasam"
                disabled={disabled}
                className="flex-1 text-xs"
              />
              {availableVillages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomVillage(false);
                    onChange({ village: '' });
                  }}
                  className="shrink-0 text-[11px] text-emerald-700 font-semibold underline px-1"
                >
                  List
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <Select
                value={isVillageInList ? (availableVillages.find((v) => v.toLowerCase() === village.toLowerCase()) ?? '') : (village ? '__CUSTOM__' : '')}
                onChange={(e) => handleVillageChange(e.target.value)}
                disabled={disabled || !taluk}
                className="w-full bg-white text-xs font-medium"
              >
                <option value="">-- Select Village ({filteredVillages.length}) --</option>
                {filteredVillages.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
                <option value="__CUSTOM__">✏️ Other (Type manually)...</option>
              </Select>
              {availableVillages.length > 8 && (
                <input
                  type="text"
                  placeholder="🔍 Quick filter village..."
                  value={villageSearch}
                  onChange={(e) => setVillageSearch(e.target.value)}
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-600"
                />
              )}
            </div>
          )}
        </Field>
      </div>

      {/* Pincode & Quick Address Hint */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Pincode">
          <Input
            value={pincode}
            onChange={(e) => onChange({ pincode: e.target.value })}
            placeholder="6-digit PIN"
            maxLength={10}
            disabled={disabled}
            className="w-full text-xs"
          />
        </Field>

        <div className="flex items-end pb-1 text-[11px] text-slate-500 font-medium">
          {taluk && district ? (
            <span className="truncate">
              📍 <strong className="text-slate-700">{taluk}</strong>, {district}, {state}
            </span>
          ) : (
            <span className="text-slate-400">Select Taluka & District above</span>
          )}
        </div>
      </div>
    </div>
  );
}
