import { PersonalityPreset, UltrawomanVoiceLines, Ultrawoman, CustomPersonalitySlot } from '../types';
import { queueServerSave } from '../services/storageSync';

export interface PersonalityDefinition {
  id: PersonalityPreset;
  name: string;
  icon: string;
  description: string;
  tags: string[];
  tone?: string;
  prompt?: string;
  voiceLines: UltrawomanVoiceLines;
}

// No built-in personality presets are shipped: users create their own slots.
// The map is intentionally empty; every consumer must tolerate a missing definition.
export const PERSONALITY_DEFINITIONS: Record<string, PersonalityDefinition> = {};

/** Neutral, empty voice-line set used whenever no personality preset is defined. */
export function createEmptyVoiceLines(): UltrawomanVoiceLines {
  return { hitSmall: [], hitHeavy: [], timerLow: [], defiant: [], wavering: [], broken: [] };
}

export function getVoiceLinesForPersonality(personality: PersonalityPreset | string): UltrawomanVoiceLines {
  const def = PERSONALITY_DEFINITIONS[personality as PersonalityPreset];
  return def ? { ...def.voiceLines } : createEmptyVoiceLines();
}

export const DEFAULT_PRESET_PERSONALITY_KEYS: PersonalityPreset[] = Object.keys(PERSONALITY_DEFINITIONS) as PersonalityPreset[];

export const DEFAULT_CUSTOM_PERSONALITY_SLOTS: CustomPersonalitySlot[] = [];

export function loadPresetPersonalitiesFromStorage(): PersonalityDefinition[] {
  try {
    const saved = localStorage.getItem('ultra_preset_personalities_v1');
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const loaded = parsed
          .map((key: string) => PERSONALITY_DEFINITIONS[key as PersonalityPreset])
          .filter(Boolean);
        if (loaded.length > 0) {
          return loaded;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load preset personalities from storage:', e);
  }
  return Object.values(PERSONALITY_DEFINITIONS);
}

export function savePresetPersonalitiesToStorage(presets: PersonalityDefinition[]): void {
  try {
    const keys = presets.map((p) => p.id);
    localStorage.setItem('ultra_preset_personalities_v1', JSON.stringify(keys));
    queueServerSave({ ultra_preset_personalities_v1: keys });
  } catch (e) {
    console.warn('Failed to save preset personalities to storage:', e);
  }
}

export function loadCustomPersonalitySlotsFromStorage(): CustomPersonalitySlot[] {
  try {
    const map = new Map<string, CustomPersonalitySlot>();
    // Initialize with default custom personality slots
    DEFAULT_CUSTOM_PERSONALITY_SLOTS.forEach((slot) => {
      if (slot && slot.id) map.set(slot.id, slot);
    });

    const saved = localStorage.getItem('ultra_custom_personality_slots_v1');
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((slot: CustomPersonalitySlot) => {
          if (slot && slot.id) map.set(slot.id, slot);
        });
      }
    }
    const merged = Array.from(map.values());
    if (merged.length > 0) {
      return merged;
    }
  } catch (e) {
    console.warn('Failed to load custom personality slots from storage:', e);
  }
  return [...DEFAULT_CUSTOM_PERSONALITY_SLOTS];
}

export function saveCustomPersonalitySlotsToStorage(slots: CustomPersonalitySlot[]): void {
  try {
    localStorage.setItem('ultra_custom_personality_slots_v1', JSON.stringify(slots));
    queueServerSave({ ultra_custom_personality_slots_v1: slots });
  } catch (e) {
    console.warn('Failed to save custom personality slots to storage:', e);
  }
}

export interface PersonalityOptionItem {
  id: string;
  name: string;
  icon: string;
  type: 'system' | 'custom';
  description?: string;
  tone?: string;
  tags?: string[];
  prompt?: string;
}

export function getAllAvailablePersonalities(
  presetList?: PersonalityDefinition[],
  customSlots?: CustomPersonalitySlot[]
): PersonalityOptionItem[] {
  const presets = presetList || loadPresetPersonalitiesFromStorage();
  const customs = customSlots || loadCustomPersonalitySlotsFromStorage();

  const list: PersonalityOptionItem[] = [];

  // Add system presets
  presets.forEach((p) => {
    list.push({
      id: p.id,
      name: p.name,
      icon: p.icon || '✨',
      type: 'system',
      description: p.description,
      tone: p.tone,
      tags: p.tags,
      prompt: p.prompt,
    });
  });

  // Add custom slots
  customs.forEach((c) => {
    list.push({
      id: c.id,
      name: c.name,
      icon: c.icon || '💎',
      type: 'custom',
      description: c.description,
      tone: c.tone,
      tags: c.tags,
      prompt: c.prompt,
    });
  });

  return list;
}

export function applyPersonalityToHero(
  hero: Ultrawoman,
  personalityKeyOrSlotId: string,
  customSlots?: CustomPersonalitySlot[]
): Ultrawoman {
  const presetDef = PERSONALITY_DEFINITIONS[personalityKeyOrSlotId as PersonalityPreset];
  if (presetDef) {
    return {
      ...hero,
      personality: presetDef.id,
      personalityCustomName: presetDef.name,
      personalityTone: presetDef.tone || '',
      personalityCustomPrompt: presetDef.prompt || '',
      personalityCustomTags: [...presetDef.tags],
      voiceLines: { ...presetDef.voiceLines },
    };
  }

  const slots = customSlots || loadCustomPersonalitySlotsFromStorage();
  const slot = slots?.find((s) => s.id === personalityKeyOrSlotId || s.name === personalityKeyOrSlotId);
  if (slot) {
    const defaultLines = createEmptyVoiceLines();
    return {
      ...hero,
      personality: slot.id,
      personalityCustomName: slot.name,
      personalityTone: slot.tone || '',
      personalityCustomPrompt: slot.prompt || '',
      personalityCustomTags: slot.tags ? [...slot.tags] : ['自定义性格'],
      voiceLines: hero.voiceLines ? { ...hero.voiceLines } : { ...defaultLines },
    };
  }

  return {
    ...hero,
    personality: personalityKeyOrSlotId,
  };
}
