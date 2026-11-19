<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('settings.remoteControl.title')"
    class="remote-control-modal"
    style="max-width: 650px; width: 100%"
  >
    <n-scrollbar>
      <div class="remote-control-setting">
        <n-form label-placement="left" label-width="auto" :style="{ maxWidth: '640px' }">
          <n-form-item :label="t('settings.remoteControl.enable')">
            <n-switch v-model:value="remoteControlConfig.enabled" />
          </n-form-item>

          <n-form-item :label="t('settings.remoteControl.port')">
            <n-input-number
              v-model:value="remoteControlConfig.port"
              :min="1024"
              :max="65535"
              :disabled="!remoteControlConfig.enabled"
            />
          </n-form-item>

          <n-form-item label="Allow LAN Access">
            <n-switch
              v-model:value="remoteControlConfig.allowLan"
              :disabled="!remoteControlConfig.enabled"
            />
          </n-form-item>

          <n-form-item label="Pairing Token / PIN">
            <n-input
              v-model:value="remoteControlConfig.authToken"
              placeholder="Required for remote playback commands"
              :disabled="!remoteControlConfig.enabled"
            />
          </n-form-item>

          <n-form-item :label="t('settings.remoteControl.allowedIps')">
            <div class="allowed-ips-container">
              <div
                v-for="(_, index) in remoteControlConfig.allowedIps"
                :key="index"
                class="ip-item"
              >
                <n-input
                  v-model:value="remoteControlConfig.allowedIps[index]"
                  :disabled="!remoteControlConfig.enabled"
                />
                <n-button
                  quaternary
                  circle
                  type="error"
                  :disabled="!remoteControlConfig.enabled"
                  @click="removeIp(index)"
                >
                  <template #icon>
                    <n-icon><i class="ri-delete-bin-line"></i></n-icon>
                  </template>
                </n-button>
              </div>
              <n-button
                secondary
                size="small"
                :disabled="!remoteControlConfig.enabled"
                @click="addIp"
              >
                <template #icon>
                  <n-icon><i class="ri-add-line"></i></n-icon>
                </template>
                {{ t('settings.remoteControl.addIp') }}
              </n-button>
              <n-text depth="3" size="small" class="allow-all-hint">
                {{ t('settings.remoteControl.emptyListHint') }}
              </n-text>
            </div>
          </n-form-item>

          <n-form-item>
            <n-space>
              <n-button type="primary" @click="saveConfig">
                {{ t('common.save') }}
              </n-button>
              <n-button @click="resetConfig">
                {{ t('common.reset') }}
              </n-button>
            </n-space>
          </n-form-item>

          <n-collapse-transition :show="remoteControlConfig.enabled">
            <div class="remote-info">
              <n-alert type="info">
                <template #icon>
                  <n-icon><i class="ri-information-line"></i></n-icon>
                </template>
                <p>{{ t('settings.remoteControl.accessInfo') }}</p>
                <div class="access-url">
                  <n-tag type="success"> http://localhost:{{ remoteControlConfig.port }}/ </n-tag>
                </div>
                <div v-if="localIpAddresses.length" class="local-ips">
                  <div v-for="ip in localIpAddresses" :key="ip" class="ip-address">
                    <n-tag type="info"> http://{{ ip }}:{{ remoteControlConfig.port }}/ </n-tag>
                  </div>
                </div>
              </n-alert>
            </div>
          </n-collapse-transition>
        </n-form>
      </div>
    </n-scrollbar>
  </n-modal>
</template>

<script setup lang="ts">
import { cloneDeep } from 'lodash';
import { useMessage } from 'naive-ui';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const message = useMessage();

const visible = defineModel('visible', { default: false });

const defaultConfig: {
  enabled: boolean;
  port: number;
  allowedIps: string[];
  allowLan?: boolean;
  authToken?: string;
} = {
  enabled: false,
  port: 31888,
  allowedIps: [],
  allowLan: false,
  authToken: ''
};

const remoteControlConfig = ref({ ...defaultConfig });

const localIpAddresses = ref<string[]>([]);

const getLocalIpAddresses = () => {
  if (window.api?.getLocalIpAddresses) {
    window.api.getLocalIpAddresses().then((ips: string[]) => {
      localIpAddresses.value = ips;
    });
  }
};

const addIp = () => {
  remoteControlConfig.value.allowedIps.push('');
};

const removeIp = (index: number) => {
  remoteControlConfig.value.allowedIps.splice(index, 1);
};

const saveConfig = () => {
  remoteControlConfig.value.allowedIps = remoteControlConfig.value.allowedIps.filter(
    (ip) => ip.trim() !== ''
  );

  if (window.api?.updateRemoteControlConfig) {
    window.api.updateRemoteControlConfig(cloneDeep(remoteControlConfig.value));
    message.success(t('settings.remoteControl.saveSuccess'));
  }
};

const resetConfig = () => {
  if (window.api?.getRemoteControlConfig) {
    window.api.getRemoteControlConfig().then((config: any) => {
      if (config) {
        remoteControlConfig.value = config;
      } else {
        remoteControlConfig.value = { ...defaultConfig };
      }
    });
  }
};

onMounted(async () => {
  if (window.api?.getRemoteControlConfig) {
    try {
      const config = await window.api.getRemoteControlConfig();
      if (config) {
        remoteControlConfig.value = config;
      }
      getLocalIpAddresses();
    } catch (error) {
      console.error('Failed to fetch remote control config:', error);
    }
  }
});
</script>

<style lang="scss" scoped>
.remote-control-setting {
  padding: 0 20px;
}

.allowed-ips-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;

  .ip-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .allow-all-hint {
    margin-top: 5px;
  }
}

.remote-info {
  margin-top: 16px;

  .access-url {
    margin-top: 10px;
  }

  .local-ips {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
}
</style>
