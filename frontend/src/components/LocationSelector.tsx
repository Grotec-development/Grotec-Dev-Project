import { useMemo, useState } from 'react';
import {
  getStates,
  getDistricts,
  getTaluks,
  getSuggestedPincode,
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

  const availableStates = useMemo(() => getStates(), []);
  const availableDistricts = useMemo(() => getDistricts(state), [state]);
  const availableTaluks = useMemo(() => getTaluks(state, district), [state, district]);

  // Check if current district is in master list
  const isDistrictInList = useMemo(() => {
    if (!district) return true;
    return availableDistricts.some((d) => d.toLowerCase() === district.toLowerCase());
  }, [district, availableDistricts]);

  // Check if current taluk is in master list
  const isTalukInList = useMemo(() => {
    if (!taluk) return true;
    return availableTaluks.some((t) => t.name.toLowerCase() === taluk.toLowerCase());
  }, [taluk, availableTaluks]);

  const showCustomDistrictInput = customDistrict || (!isDistrictInList && Boolean(district));
  const showCustomTalukInput = customTaluk || (!isTalukInList && Boolean(taluk));

  function handleStateChange(newState: string) {
    const nextDistricts = getDistricts(newState);
    const newDistrict = nextDistricts[0] || '';
    const nextTaluks = getTaluks(newState, newDistrict);
    const newTaluk = nextTaluks[0]?.name || '';
    const suggestedPin = getSuggestedPincode(newState, newDistrict, newTaluk) || '';

    setCustomDistrict(false);
    setCustomTaluk(false);

    onChange({
      state: newState,
      district: newDistrict,
      taluk: newTaluk,
      pincode: suggestedPin,
    });
  }

  function handleDistrictChange(newDistrict: string) {
    if (newDistrict === '__CUSTOM__') {
      setCustomDistrict(true);
      onChange({ district: '', taluk: '' });
      return;
    }
    setCustomDistrict(false);
    setCustomTaluk(false);

    const nextTaluks = getTaluks(state, newDistrict);
    const newTaluk = nextTaluks[0]?.name || '';
    const suggestedPin = getSuggestedPincode(state, newDistrict, newTaluk) || '';

    onChange({
      district: newDistrict,
      taluk: newTaluk,
      pincode: suggestedPin || pincode,
    });
  }

  function handleTalukChange(newTaluk: string) {
    if (newTaluk === '__CUSTOM__') {
      setCustomTaluk(true);
      onChange({ taluk: '' });
      return;
    }
    setCustomTaluk(false);
    const suggestedPin = getSuggestedPincode(state, district, newTaluk);
    onChange({
      taluk: newTaluk,
      pincode: suggestedPin || pincode,
    });
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
              value={district}
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
          <Input
            value={village}
            onChange={(e) => onChange({ village: e.target.value })}
            placeholder="e.g. Melakkal, Papanasam"
            disabled={disabled}
            className="w-full text-xs"
          />
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
