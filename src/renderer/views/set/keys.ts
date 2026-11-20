import type { DialogApi, MessageApi } from 'naive-ui';
import type { InjectionKey, Ref, WritableComputedRef } from 'vue';

export const SETTINGS_DATA_KEY = Symbol('settings-data') as InjectionKey<WritableComputedRef<any>>;
export const SETTINGS_MESSAGE_KEY = Symbol('settings-message') as InjectionKey<MessageApi>;
export const SETTINGS_DIALOG_KEY = Symbol('settings-dialog') as InjectionKey<DialogApi>;
export const SETTINGS_SEARCH_KEY = Symbol('settings-search') as InjectionKey<Ref<string>>;
