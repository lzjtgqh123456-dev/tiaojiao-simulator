import { RelationshipSlot } from '../types';

// No built-in relationship presets are shipped: users create their own slots.
export const DEFAULT_RELATIONSHIP_SLOTS: RelationshipSlot[] = [];

/**
 * Neutral runtime placeholder used only when the user has not created any
 * relationship slot yet (so the UI always has a valid object to render).
 * It is not part of the default library and disappears once a real slot exists.
 */
export const NEUTRAL_RELATIONSHIP_SLOT: RelationshipSlot = {
  id: '__unset_relationship__',
  title: '未设定关系',
  category: 'custom',
  description: '尚未设定关系。请在「关系管理」中创建属于你的关系槽位。',
  stylePrompt: '按自然、平等的语气交流，不附加任何预设关系设定。',
  customTags: [],
  conditions: {},
};
