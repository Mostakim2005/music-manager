<template>
  <div class="local-music-page h-full w-full bg-white dark:bg-black transition-colors duration-500">
    <n-scrollbar class="h-full">
      <div class="local-music-content pb-32">
        <!-- Hero Section -->
        <section class="hero-section relative overflow-hidden rounded-tl-2xl">
          <div class="hero-bg absolute inset-0 -top-20">
            <div
              class="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10 blur-3xl opacity-50 dark:opacity-30"
            ></div>
            <div
              class="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-black/80 dark:to-black"
            ></div>
          </div>

          <div class="hero-content relative z-10 page-padding-x pt-6 pb-4">
            <div class="flex items-center gap-5">
              <MultiArtworkCard
                :covers="libraryCollageCovers"
                size="80px"
                fallback-icon="ri-folder-music-fill"
              />

              <div class="info-content min-w-0">
                <h1
                  class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight"
                >
                  {{ t('localMusic.title') }}
                </h1>
                <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {{ t('localMusic.songCount', { count: localMusicStore.visibleMusicList.length }) }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Action Bar (Sticky on scroll) -->
        <section
          class="action-bar sticky top-0 z-20 page-padding-x py-3 md:py-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-neutral-100 dark:border-neutral-800/50"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1 max-w-xs">
              <n-input
                v-model:value="searchKeyword"
                :placeholder="t('localMusic.search')"
                clearable
                size="small"
                round
              >
                <template #prefix>
                  <i class="ri-search-line text-neutral-400" />
                </template>
              </n-input>
            </div>

            <div class="flex items-center gap-3">
              <button
                v-if="filteredList.length > 0"
                class="action-btn-pill flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all bg-primary text-white hover:bg-primary/90"
                @click="handlePlayAll"
              >
                <i class="ri-play-fill text-lg" />
                <span class="hidden md:inline">{{ t('localMusic.playAll') }}</span>
              </button>

              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                :disabled="localMusicStore.scanning"
                @click="handleScan"
              >
                <i
                  class="ri-refresh-line text-lg"
                  :class="{ 'animate-spin': localMusicStore.scanning }"
                />
              </button>

              <!-- Automatic metadata repair -->
              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
                title="Find and write missing metadata for the whole library"
                :disabled="localMusicStore.autoTagging || localMusicStore.scanning"
                @click="handleAutoFixMetadata"
              >
                <i
                  class="ri-magic-line text-lg"
                  :class="{ 'animate-pulse text-primary': localMusicStore.autoTagging }"
                />
              </button>

              <!-- Acoustic index and duplicate merging -->
              <n-dropdown
                trigger="click"
                :options="acousticDropdownOptions"
                @select="handleAcousticAction"
              >
                <button
                  class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
                  title="Acoustic index and duplicate recordings"
                  :disabled="localMusicStore.buildingFingerprints || localMusicStore.scanning"
                >
                  <i
                    class="ri-fingerprint-line text-lg"
                    :class="{ 'animate-pulse text-primary': localMusicStore.buildingFingerprints }"
                  />
                </button>
              </n-dropdown>

              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                @click="handleAddFolder"
              >
                <i class="ri-folder-add-line text-lg" />
              </button>

              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                title="Manage Library Folders, Exclusions, Min Duration & Artist Allowlist"
                @click="showFolderManager = true"
              >
                <i class="ri-folder-settings-line text-lg" />
              </button>

              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                title="Personal Listening Stats & Wrapped"
                @click="showListeningStats = true"
              >
                <i class="ri-bar-chart-box-line text-lg" />
              </button>

              <n-dropdown
                trigger="click"
                :options="backupDropdownOptions"
                @select="handleBackupAction"
              >
                <button
                  class="action-btn-icon px-3 h-10 rounded-full flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all text-xs font-medium"
                  title="Export / Import M3U8 Playlist & JSON Library Backup"
                >
                  <i class="ri-database-2-line text-base" />
                  <span class="hidden lg:inline">M3U8 / Backup</span>
                </button>
              </n-dropdown>
            </div>
          </div>
        </section>

        <!-- Library maintenance progress -->
        <section
          v-if="
            localMusicStore.scanning ||
            localMusicStore.autoTagging ||
            localMusicStore.buildingFingerprints
          "
          class="page-padding-x mt-6"
        >
          <div
            class="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/20"
          >
            <n-spin size="small" />
            <div>
              <p class="text-sm font-medium text-neutral-900 dark:text-white">
                {{ maintenanceLabel }}
              </p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {{ maintenanceDetail }}
              </p>
            </div>
          </div>
        </section>

        <section class="list-section page-padding-x mt-5">
          <!-- Library View Tabs -->
          <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div class="inline-flex items-center gap-1 p-1 rounded-full bg-neutral-100 dark:bg-neutral-900">
              <button
                type="button"
                class="px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors"
                :class="
                  activeTab === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                "
                @click="activeTab = 'all'"
              >
                All Tracks ({{ filteredList.length }})
              </button>
              <button
                type="button"
                class="px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors"
                :class="
                  activeTab === 'folders'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                "
                @click="activeTab = 'folders'"
              >
                Folders ({{ folderGroups.length }})
              </button>
              <button
                type="button"
                class="px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors"
                :class="
                  activeTab === 'smart'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                "
                @click="activeTab = 'smart'"
              >
                Smart Playlists ({{ smartPlaylists.length }})
              </button>
            </div>
          </div>

          <!-- TAB: ALL TRACKS -->
          <template v-if="activeTab === 'all'">
            <div
              v-if="!localMusicStore.scanning && filteredList.length === 0"
              class="empty-state py-20 text-center"
            >
              <i class="ri-folder-music-fill text-5xl mb-4 text-neutral-200 dark:text-neutral-800" />
              <p class="text-neutral-400">{{ t('localMusic.emptyState') }}</p>
              <button
                class="mt-6 px-6 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
                @click="handleAddFolder"
              >
                <i class="ri-folder-add-line mr-2" />
                {{ t('localMusic.scanFolder') }}
              </button>
            </div>

            <div v-else-if="filteredList.length > 0" class="song-list-container space-y-1">
              <local-track-row
                v-for="(item, index) in filteredSongResults"
                :key="item.id"
                :index="index"
                :item="item"
                :entry="filteredList[index]"
                :play-count="getTrackPlayCount(item)"
                :rating="getEntryAnnotation(filteredList[index]).rating"
                :moods="getEntryAnnotation(filteredList[index]).moods"
                :tags="getEntryAnnotation(filteredList[index]).tags"
                @play="handlePlaySong"
                @play-next="handlePlayNext"
                @queue-end="handleAddToQueueEnd"
                @edit="openTrackEditor"
                @edit-tags="openTagEditor"
                @remove="handleRemoveSong(item.id)"
              />
            </div>
          </template>

          <!-- TAB: FOLDERS BROWSER -->
          <template v-else-if="activeTab === 'folders'">
            <div v-if="folderGroups.length === 0" class="py-16 text-center text-neutral-400 text-sm">
              No scanned folders found yet.
            </div>
            <div v-else class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div
                  v-for="group in folderGroups"
                  :key="group.dir"
                  class="p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3"
                  :class="
                    activeFolderDir === group.dir
                      ? 'bg-primary/10 border-primary/40'
                      : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200/70 dark:border-neutral-800 hover:border-primary/30'
                  "
                  @click="activeFolderDir = activeFolderDir === group.dir ? '' : group.dir"
                >
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-semibold text-neutral-900 dark:text-white truncate flex items-center gap-1.5">
                      <i class="ri-folder-music-line text-primary" />
                      {{ group.label }}
                    </div>
                    <div class="text-[11px] text-neutral-400 truncate mt-0.5" :title="group.dir">
                      {{ group.dir }}
                    </div>
                    <div class="text-[11px] text-neutral-500 mt-1">
                      {{ group.entries.length }} tracks
                    </div>
                  </div>
                  <n-button
                    size="tiny"
                    type="primary"
                    secondary
                    @click.stop="playSongBatch(group.songResults)"
                  >
                    Play
                  </n-button>
                </div>
              </div>

              <div v-if="selectedFolderGroup" class="space-y-1 pt-2">
                <div class="text-xs font-semibold text-neutral-500 mb-2">
                  {{ selectedFolderGroup.dir }} ({{ selectedFolderGroup.entries.length }} tracks)
                </div>
                <local-track-row
                  v-for="(item, index) in selectedFolderGroup.songResults"
                  :key="`folder-${item.id}`"
                  :index="index"
                  :item="item"
                  :entry="selectedFolderGroup.entries[index]"
                  :play-count="getTrackPlayCount(item)"
                  :rating="getEntryAnnotation(selectedFolderGroup.entries[index]).rating"
                  :moods="getEntryAnnotation(selectedFolderGroup.entries[index]).moods"
                  :tags="getEntryAnnotation(selectedFolderGroup.entries[index]).tags"
                  @play="handlePlaySong($event, selectedFolderGroup.songResults)"
                  @play-next="handlePlayNext"
                  @queue-end="handleAddToQueueEnd"
                  @edit="openTrackEditor"
                  @edit-tags="openTagEditor"
                  @remove="handleRemoveSong(item.id)"
                />
              </div>
            </div>
          </template>

          <!-- TAB: SMART PLAYLISTS -->
          <template v-else-if="activeTab === 'smart'">
            <div class="space-y-4">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <n-tag
                    v-for="sp in smartPlaylists"
                    :key="sp.id"
                    :type="selectedSmartPlaylistId === sp.id ? 'success' : 'default'"
                    round
                    clickable
                    @click="selectedSmartPlaylistId = sp.id"
                  >
                    {{ sp.name }}
                  </n-tag>
                  <span v-if="smartPlaylists.length === 0" class="text-xs text-neutral-400">
                    No smart playlists saved yet.
                  </span>
                </div>
                <n-button size="small" type="primary" secondary @click="startNewSmartPlaylist">
                  {{ showSmartBuilder ? 'Close Builder' : '+ New Smart Playlist' }}
                </n-button>
              </div>

              <!-- Smart Playlist Rule Builder -->
              <div
                v-if="showSmartBuilder"
                class="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3"
              >
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <n-input v-model:value="smartDraftName" size="small" placeholder="Playlist Name" />
                  <n-select
                    v-model:value="smartDraftMatchMode"
                    size="small"
                    :options="[
                      { label: 'Match ALL rules (AND)', value: 'all' },
                      { label: 'Match ANY rule (OR)', value: 'any' }
                    ]"
                  />
                  <n-select
                    v-model:value="smartDraftSortBy"
                    size="small"
                    :options="[
                      { label: 'Sort: Recently Updated', value: 'recent' },
                      { label: 'Sort: Rating (High -> Low)', value: 'rating' },
                      { label: 'Sort: Play Count', value: 'playCount' },
                      { label: 'Sort: Title', value: 'title' },
                      { label: 'Sort: Artist', value: 'artist' },
                      { label: 'Sort: Duration', value: 'duration' }
                    ]"
                  />
                </div>

                <div class="space-y-2">
                  <div
                    v-for="(rule, rIdx) in smartDraftRules"
                    :key="rIdx"
                    class="flex items-center gap-2 flex-wrap"
                  >
                    <n-select
                      v-model:value="rule.field"
                      size="small"
                      style="width: 160px"
                      :options="smartRuleFieldOptions"
                    />
                    <n-select
                      v-model:value="rule.operator"
                      size="small"
                      style="width: 130px"
                      :options="smartRuleOpOptions"
                    />
                    <n-input
                      v-model:value="rule.value as string"
                      size="small"
                      style="width: 180px"
                      placeholder="Value (e.g. 4, Chill, FLAC)"
                    />
                    <n-button
                      size="small"
                      quaternary
                      type="error"
                      @click="smartDraftRules.splice(rIdx, 1)"
                    >
                      Remove
                    </n-button>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-2">
                  <n-button size="tiny" secondary @click="addSmartRuleRow">+ Add Rule</n-button>
                  <div class="flex items-center gap-2">
                    <n-input-number
                      v-model:value="smartDraftLimit"
                      size="tiny"
                      :min="0"
                      :max="500"
                      placeholder="Limit (0=all)"
                      style="width: 130px"
                    />
                    <n-button size="small" type="primary" @click="handleSaveSmartPlaylist">
                      Save Playlist
                    </n-button>
                  </div>
                </div>
              </div>

              <!-- Selected Smart Playlist Matches -->
              <div v-if="activeSmartPlaylist" class="space-y-2">
                <div
                  class="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800"
                >
                  <div>
                    <div class="text-sm font-semibold text-neutral-900 dark:text-white">
                      {{ activeSmartPlaylist.name }}
                    </div>
                    <div class="text-xs text-neutral-500">
                      {{ smartMatchedTracks.length }} matched track(s) ·
                      {{ activeSmartPlaylist.rules.length }} rule(s) ({{ activeSmartPlaylist.matchMode.toUpperCase() }})
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <n-button
                      v-if="smartMatchedSongResults.length > 0"
                      size="tiny"
                      type="primary"
                      @click="playSongBatch(smartMatchedSongResults)"
                    >
                      Play All
                    </n-button>
                    <n-button
                      size="tiny"
                      type="error"
                      secondary
                      @click="handleDeleteSmartPlaylist(activeSmartPlaylist.id)"
                    >
                      Delete
                    </n-button>
                  </div>
                </div>

                <div v-if="smartMatchedTracks.length === 0" class="py-10 text-center text-xs text-neutral-400">
                  No local tracks match this smart playlist's rules yet.
                </div>
                <local-track-row
                  v-for="(item, index) in smartMatchedSongResults"
                  :key="`smart-${item.id}`"
                  :index="index"
                  :item="item"
                  :entry="smartMatchedTracks[index]"
                  :play-count="getTrackPlayCount(item)"
                  :rating="getEntryAnnotation(smartMatchedTracks[index]).rating"
                  :moods="getEntryAnnotation(smartMatchedTracks[index]).moods"
                  :tags="getEntryAnnotation(smartMatchedTracks[index]).tags"
                  @play="handlePlaySong($event, smartMatchedSongResults)"
                  @play-next="handlePlayNext"
                  @queue-end="handleAddToQueueEnd"
                  @edit="openTrackEditor"
                  @edit-tags="openTagEditor"
                  @remove="handleRemoveSong(item.id)"
                />
              </div>
            </div>
          </template>
        </section>
      </div>
    </n-scrollbar>

    <n-drawer v-model:show="showFolderManager" :width="440" placement="right">
      <n-drawer-content :title="t('localMusic.removeFolder')" closable>
        <div class="space-y-6 py-4">
          <!-- Library Folders -->
          <div class="space-y-2">
            <div class="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Scanned Library Folders
            </div>
            <div
              v-for="folder in localMusicStore.folderPaths"
              :key="folder"
              class="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <i class="ri-folder-line text-lg text-primary flex-shrink-0" />
                <span class="text-sm text-neutral-700 dark:text-neutral-300 truncate">{{
                  folder
                }}</span>
              </div>
              <button
                class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0 ml-2"
                @click="handleRemoveFolder(folder)"
              >
                <i class="ri-delete-bin-line" />
              </button>
            </div>
            <div v-if="localMusicStore.folderPaths.length === 0" class="text-center py-4 text-xs text-neutral-400">
              {{ t('localMusic.emptyState') }}
            </div>
          </div>

          <!-- Excluded Subfolders -->
          <div class="space-y-2 border-t border-neutral-100 dark:border-neutral-800 pt-4">
            <div class="flex items-center justify-between">
              <div class="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Excluded Subfolders
              </div>
              <n-button size="tiny" secondary @click="handleAddExcludedFolder">
                + Exclude Folder
              </n-button>
            </div>
            <div
              v-for="exc in localMusicStore.excludedFolders"
              :key="exc"
              class="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 text-xs"
            >
              <span class="truncate text-neutral-600 dark:text-neutral-300">{{ exc }}</span>
              <button
                class="text-neutral-400 hover:text-red-500 ml-2"
                @click="localMusicStore.removeExcludedFolder(exc)"
              >
                <i class="ri-close-line text-sm" />
              </button>
            </div>
            <div v-if="localMusicStore.excludedFolders.length === 0" class="text-xs text-neutral-400">
              None. Click "Exclude Folder" to skip ringtone/sample subfolders on scan.
            </div>
          </div>

          <!-- Minimum Track Duration Filter -->
          <div class="space-y-2 border-t border-neutral-100 dark:border-neutral-800 pt-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Minimum Duration (seconds)
                </div>
                <div class="text-[11px] text-neutral-500">
                  Hides short SFX/notification clips (0 = show all).
                </div>
              </div>
              <n-input-number
                :value="localMusicStore.minDurationSec"
                :min="0"
                :max="600"
                size="small"
                style="width: 110px"
                @update:value="(val) => localMusicStore.setMinDurationSec(val ?? 0)"
              />
            </div>
          </div>

          <!-- Artist Split Exception Allowlist -->
          <div class="space-y-2 border-t border-neutral-100 dark:border-neutral-800 pt-4">
            <div class="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Artist Split Exceptions (Allowlist)
            </div>
            <div class="text-[11px] text-neutral-500">
              Combined artist names kept intact instead of splitting on "," or "&amp;".
            </div>
            <div class="flex items-center gap-2">
              <n-input
                v-model:value="newArtistException"
                size="small"
                placeholder="e.g. Crosby & Stills"
                @keydown.enter="handleAddArtistException"
              />
              <n-button size="small" secondary @click="handleAddArtistException">Add</n-button>
            </div>
            <div class="flex flex-wrap gap-1.5 pt-1">
              <n-tag
                v-for="exc in customArtistExceptions"
                :key="exc"
                size="small"
                type="info"
                closable
                @close="handleRemoveArtistException(exc)"
              >
                {{ exc }}
              </n-tag>
              <n-tag
                v-for="builtIn in defaultArtistExceptions"
                :key="builtIn"
                size="small"
                :bordered="false"
              >
                {{ builtIn }}
              </n-tag>
            </div>
          </div>
        </div>

        <template #footer>
          <n-button type="primary" block @click="handleAddFolder">
            <template #icon>
              <i class="ri-folder-add-line" />
            </template>
            {{ t('localMusic.scanFolder') }}
          </n-button>
        </template>
      </n-drawer-content>
    </n-drawer>

    <!-- Track Rating, Mood & Tags Modal -->
    <n-modal v-model:show="showTagModal" preset="card" title="Rate &amp; Tag Track" style="max-width: 440px">
      <div v-if="taggingEntry" class="space-y-4">
        <div class="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
          {{ taggingEntry.title }} — {{ taggingEntry.artist }}
        </div>
        <div class="flex items-center justify-between">
          <span class="text-xs text-neutral-500">Rating (0–5)</span>
          <n-rate v-model:value="tagDraftRating" clearable />
        </div>
        <div class="space-y-1">
          <div class="text-xs text-neutral-500">Moods (comma separated)</div>
          <n-input v-model:value="tagDraftMoods" size="small" placeholder="Chill, Late Night, Focus" />
        </div>
        <div class="space-y-1">
          <div class="text-xs text-neutral-500">Custom Tags (comma separated)</div>
          <n-input v-model:value="tagDraftTags" size="small" placeholder="Acoustic, Vinyl Rip" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <n-button size="small" @click="showTagModal = false">Cancel</n-button>
          <n-button size="small" type="primary" @click="handleSaveTrackTags">Save</n-button>
        </div>
      </div>
    </n-modal>

    <local-track-editor-modal
      v-model:show="showTrackEditor"
      :entry="editingEntry"
      @saved="handleTrackSaved"
    />

    <listening-stats-modal v-model:show="showListeningStats" />
  </div>
</template>

<script setup lang="ts">
import { createDiscreteApi, type DropdownOption, NButton } from 'naive-ui';
import { computed, h, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import LocalTrackEditorModal from '@/components/common/LocalTrackEditorModal.vue';
import MultiArtworkCard from '@/components/namida/MultiArtworkCard.vue';
import ListeningStatsModal from '@/components/player/ListeningStatsModal.vue';
import {
  exportListeningStatsRaw,
  getListeningStatsSummary,
  importListeningStatsRaw
} from '@/services/listeningStatsService';
import {
  deleteSmartPlaylist,
  evaluateSmartPlaylist,
  getSongAnnotationMap,
  listSmartPlaylists,
  saveSmartPlaylist,
  type SmartPlaylistField,
  type SmartPlaylistOperator,
  type SmartPlaylistRecord,
  type SmartPlaylistRule,
  type SongAnnotationRecord,
  updateSongTagsAndRating
} from '@/services/songLibrary';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { usePlayerStore } from '@/store/modules/player';
import type { LocalMusicEntry } from '@/types/localMusic';
import type { SongResult } from '@/types/music';
import {
  debounceIngestLocalTracks,
  DEFAULT_ARTIST_EXCEPTIONS,
  filterByKeyword,
  getArtistSplitExceptions,
  setArtistSplitExceptions,
  toSongResult
} from '@/utils/localMusicUtils';

import LocalTrackRow from './LocalTrackRow.vue';

// ==================== Stores ====================
const { t } = useI18n();
const { message, notification } = createDiscreteApi(['message', 'notification']);
const localMusicStore = useLocalMusicStore();
const playerStore = usePlayerStore();

// ==================== State ====================
const searchKeyword = ref('');
const activeTab = ref<'all' | 'folders' | 'smart'>('all');
const activeFolderDir = ref('');
const showFolderManager = ref(false);
const showTrackEditor = ref(false);
const editingEntry = ref<LocalMusicEntry | null>(null);
const showListeningStats = ref(false);

const trackAnnotations = ref<{
  byPath: Record<string, SongAnnotationRecord>;
  bySongId: Record<string, SongAnnotationRecord>;
}>({ byPath: {}, bySongId: {} });
const trackPlayCounts = ref<Record<string, number>>({});

const showTagModal = ref(false);
const taggingEntry = ref<LocalMusicEntry | null>(null);
const tagDraftRating = ref(0);
const tagDraftMoods = ref('');
const tagDraftTags = ref('');

const defaultArtistExceptions = DEFAULT_ARTIST_EXCEPTIONS;
const customArtistExceptions = ref<string[]>(getArtistSplitExceptions());
const newArtistException = ref('');

const smartPlaylists = ref<SmartPlaylistRecord[]>([]);
const selectedSmartPlaylistId = ref('');
const showSmartBuilder = ref(false);
const smartDraftName = ref('');
const smartDraftMatchMode = ref<'all' | 'any'>('all');
const smartDraftSortBy = ref<SmartPlaylistRecord['sortBy']>('recent');
const smartDraftLimit = ref<number | null>(0);
const smartDraftRules = ref<Array<{ field: SmartPlaylistField; operator: SmartPlaylistOperator; value: string }>>([
  { field: 'rating', operator: 'gte', value: '4' }
]);

const smartRuleFieldOptions = [
  { label: 'Rating (0-5)', value: 'rating' },
  { label: 'Mood', value: 'mood' },
  { label: 'Tag', value: 'tag' },
  { label: 'Genre', value: 'genre' },
  { label: 'Artist', value: 'artist' },
  { label: 'Min Duration (sec)', value: 'minDurationSec' },
  { label: 'Max Duration (sec)', value: 'maxDurationSec' },
  { label: 'Has Linked Video', value: 'hasVideo' },
  { label: 'Play Count', value: 'playCount' }
];

const smartRuleOpOptions = [
  { label: 'Contains', value: 'contains' },
  { label: 'Equals', value: 'eq' },
  { label: '>= (at least)', value: 'gte' },
  { label: '<= (at most)', value: 'lte' },
  { label: 'Includes', value: 'includes' }
];

const acousticDropdownOptions: DropdownOption[] = [
  {
    label: 'Build acoustic index',
    key: 'index',
    icon: () => h('i', { class: 'ri-fingerprint-line' })
  },
  {
    label: 'Index, then merge duplicate recordings',
    key: 'both',
    icon: () => h('i', { class: 'ri-merge-cells-horizontal' })
  },
  {
    label: 'Merge duplicates only',
    key: 'merge',
    icon: () => h('i', { class: 'ri-links-line' })
  }
];

const backupDropdownOptions: DropdownOption[] = [
  {
    label: 'Export Playlist as .M3U8',
    key: 'export-m3u8',
    icon: () => h('i', { class: 'ri-file-music-line' })
  },
  {
    label: 'Import .M3U / .M3U8 Playlist',
    key: 'import-m3u8',
    icon: () => h('i', { class: 'ri-folder-upload-line' })
  },
  {
    label: 'Export Full Library & Stats (.JSON Backup)',
    key: 'export-json',
    icon: () => h('i', { class: 'ri-download-cloud-2-line' })
  },
  {
    label: 'Restore Library & Stats from .JSON Backup',
    key: 'import-json',
    icon: () => h('i', { class: 'ri-upload-cloud-2-line' })
  }
];

async function handleBackupAction(key: string) {
  try {
    if (key === 'export-m3u8') {
      const tracks = filteredList.value.map((item) => ({
        filePath: item.filePath,
        title: item.title,
        artist: item.artist,
        durationSec: item.duration ? Math.round(item.duration / 1000) : -1
      }));
      const res: any = await window.api.exportM3u8({
        defaultName: 'MusicManager-LocalLibrary',
        tracks
      });
      if (res?.ok) {
        message.success(`Exported ${res.count ?? tracks.length} tracks to ${res.filePath}`);
      } else if (res && !res.canceled && res.error) {
        message.error(res.error);
      }
    } else if (key === 'import-m3u8') {
      const res: any = await window.api.importM3u8();
      if (res?.ok && Array.isArray(res.filePaths) && res.filePaths.length > 0) {
        const parsed = await window.api.parseLocalMusicMetadata(res.filePaths);
        for (const meta of parsed) {
          await localMusicStore.updateEntry(meta);
        }
        message.success(`Imported ${parsed.length} track(s) from M3U8 playlist!`);
      } else if (res && !res.canceled && res.error) {
        message.error(res.error);
      }
    } else if (key === 'export-json') {
      const payload = {
        folderPaths: localMusicStore.folderPaths,
        musicList: localMusicStore.musicList,
        listeningStats: exportListeningStatsRaw()
      };
      const res: any = await window.api.exportBackupJson({ payload });
      if (res?.ok) {
        message.success(`Saved library & stats backup to ${res.filePath}`);
      } else if (res && !res.canceled && res.error) {
        message.error(res.error);
      }
    } else if (key === 'import-json') {
      const res: any = await window.api.importBackupJson();
      if (res?.ok && res.payload) {
        const { folderPaths, musicList, listeningStats } = res.payload;
        if (Array.isArray(folderPaths)) {
          for (const folder of folderPaths) {
            localMusicStore.addFolder(folder);
          }
        }
        if (Array.isArray(musicList)) {
          for (const entry of musicList) {
            if (entry && entry.id && entry.filePath) {
              await localMusicStore.updateEntry(entry);
            }
          }
        }
        if (listeningStats && typeof listeningStats === 'object') {
          importListeningStatsRaw(listeningStats);
        }
        message.success('Restored library folders, tracks, and listening stats from backup!');
      } else if (res && !res.canceled && res.error) {
        message.error(res.error);
      }
    }
  } catch (err) {
    message.error(`Backup operation failed: ${String(err)}`);
  }
}

/** Runs the online metadata lookup + tag write pass over the library. */
async function handleAutoFixMetadata(): Promise<void> {
  try {
    const result = await localMusicStore.autoFixMetadata();
    if (result.fixed > 0) {
      message.success(`Updated metadata for ${result.fixed} track(s).`);
    } else if (result.skipped === 0 && result.failed === 0) {
      message.info('Every track already has usable metadata.');
    }
    if (result.skipped > 0) {
      message.info(`${result.skipped} track(s) had no online match.`);
    }
    if (result.failed > 0) {
      message.warning(`Could not write tags for ${result.failed} track(s).`);
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
}

/** Builds the acoustic index and/or merges proven duplicates. */
async function handleAcousticAction(key: string): Promise<void> {
  try {
    if (key === 'index' || key === 'both') {
      const indexResult = await localMusicStore.buildFingerprintIndex();
      message.success(
        `Indexed ${indexResult.indexed} track(s)` +
          (indexResult.failed ? `, ${indexResult.failed} failed` : '') +
          (indexResult.skipped ? `, ${indexResult.skipped} already indexed` : '') +
          '.'
      );
    }

    if (key === 'merge' || key === 'both') {
      const mergeResult = await localMusicStore.mergeDuplicateRecordings();
      message.success(
        mergeResult.merged > 0
          ? `Merged ${mergeResult.merged} duplicate recording(s).`
          : 'No duplicate recordings found.'
      );
      triggerIngest();
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
}

function openTrackEditor(entry: LocalMusicEntry) {
  editingEntry.value = entry;
  showTrackEditor.value = true;
}

async function handleTrackSaved(updatedEntry: LocalMusicEntry, oldId: string) {
  await localMusicStore.updateEntry(updatedEntry, oldId);
  await loadAnnotations();
}

function getEntryAnnotation(entry: LocalMusicEntry): SongAnnotationRecord {
  return (
    trackAnnotations.value.byPath[entry.filePath] ||
    trackAnnotations.value.bySongId[entry.id] || { rating: 0, moods: [], tags: [] }
  );
}

function getTrackPlayCount(item: SongResult): number {
  return (
    trackPlayCounts.value[String(item.id)] ??
    trackPlayCounts.value[item.name] ??
    0
  );
}

function refreshPlayCounts() {
  try {
    const summary = getListeningStatsSummary();
    const map: Record<string, number> = {};
    for (const track of summary.topTracks) {
      map[String(track.id)] = track.plays;
      if (track.name && map[track.name] === undefined) {
        map[track.name] = track.plays;
      }
    }
    trackPlayCounts.value = map;
  } catch {
    trackPlayCounts.value = {};
  }
}

async function loadAnnotations() {
  try {
    trackAnnotations.value = await getSongAnnotationMap();
  } catch {
    trackAnnotations.value = { byPath: {}, bySongId: {} };
  }
}

async function refreshSmartPlaylists() {
  try {
    smartPlaylists.value = await listSmartPlaylists();
    if (!selectedSmartPlaylistId.value && smartPlaylists.value[0]) {
      selectedSmartPlaylistId.value = smartPlaylists.value[0].id;
    }
  } catch {
    smartPlaylists.value = [];
  }
}

function openTagEditor(entry: LocalMusicEntry) {
  const ann = getEntryAnnotation(entry);
  taggingEntry.value = entry;
  tagDraftRating.value = ann.rating;
  tagDraftMoods.value = ann.moods.join(', ');
  tagDraftTags.value = ann.tags.join(', ');
  showTagModal.value = true;
}

async function handleSaveTrackTags() {
  if (!taggingEntry.value) return;
  const entry = taggingEntry.value;
  await updateSongTagsAndRating({
    filePath: entry.filePath,
    title: entry.title,
    artist: entry.artist,
    album: entry.album,
    durationSec: entry.duration ? Math.round(entry.duration / 1000) : 0,
    rating: tagDraftRating.value,
    moods: tagDraftMoods.value.split(',').map((s) => s.trim()).filter(Boolean),
    tags: tagDraftTags.value.split(',').map((s) => s.trim()).filter(Boolean)
  });
  await loadAnnotations();
  showTagModal.value = false;
  message.success('Saved track rating, moods & tags.');
}

function handlePlayNext(song: SongResult) {
  playerStore.addToNextPlay(song);
  message.success(`Added "${song.name}" to Play Next.`);
}

function handleAddToQueueEnd(song: SongResult) {
  playerStore.addToQueueEnd(song);
  message.success(`Appended "${song.name}" to queue.`);
}

async function handleAddExcludedFolder() {
  try {
    const result = await window.api.selectDirectory();
    if (result && !result.canceled && result.filePaths?.length > 0) {
      localMusicStore.addExcludedFolder(result.filePaths[0]);
      message.success(`Excluded ${result.filePaths[0]}.`);
    }
  } catch (error) {
    message.error(String(error));
  }
}

function handleAddArtistException() {
  const raw = newArtistException.value.trim();
  if (!raw) return;
  customArtistExceptions.value = setArtistSplitExceptions([...customArtistExceptions.value, raw]);
  newArtistException.value = '';
}

function handleRemoveArtistException(exc: string) {
  customArtistExceptions.value = setArtistSplitExceptions(
    customArtistExceptions.value.filter((item) => item !== exc)
  );
}

function startNewSmartPlaylist() {
  showSmartBuilder.value = !showSmartBuilder.value;
}

function addSmartRuleRow() {
  smartDraftRules.value.push({ field: 'genre', operator: 'contains', value: '' });
}

async function handleSaveSmartPlaylist() {
  const name = smartDraftName.value.trim();
  if (!name) {
    message.warning('Enter a smart playlist name.');
    return;
  }
  const rules: SmartPlaylistRule[] = smartDraftRules.value
    .filter((r) => String(r.value).trim() !== '')
    .map((r) => ({
      field: r.field,
      operator: r.operator,
      value:
        r.field === 'rating' || r.field === 'minDurationSec' || r.field === 'maxDurationSec' || r.field === 'playCount'
          ? Number(r.value)
          : r.value
    }));
  const saved = await saveSmartPlaylist({
    name,
    matchMode: smartDraftMatchMode.value,
    rules,
    sortBy: smartDraftSortBy.value,
    limit: smartDraftLimit.value && smartDraftLimit.value > 0 ? smartDraftLimit.value : undefined
  });
  await refreshSmartPlaylists();
  selectedSmartPlaylistId.value = saved.id;
  showSmartBuilder.value = false;
  smartDraftName.value = '';
  message.success(`Saved smart playlist "${saved.name}".`);
}

async function handleDeleteSmartPlaylist(id: string) {
  await deleteSmartPlaylist(id);
  if (selectedSmartPlaylistId.value === id) {
    selectedSmartPlaylistId.value = '';
  }
  await refreshSmartPlaylists();
  message.success('Deleted smart playlist.');
}

// ==================== Computed ====================
const filteredList = computed(() => {
  return filterByKeyword(localMusicStore.visibleMusicList, searchKeyword.value);
});

const filteredSongResults = computed(() => {
  return filteredList.value.map(toSongResult);
});

const annotatedFilteredList = computed(() =>
  filteredList.value.map((entry) => {
    const ann = getEntryAnnotation(entry);
    return {
      ...entry,
      rating: ann.rating,
      moods: ann.moods,
      tags: ann.tags
    };
  })
);

function extractParentFolder(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return idx > 0 ? filePath.slice(0, idx) : 'Library Root';
}

const folderGroups = computed(() => {
  const map = new Map<string, LocalMusicEntry[]>();
  for (const entry of filteredList.value) {
    const dir = extractParentFolder(entry.filePath);
    const list = map.get(dir) || [];
    list.push(entry);
    map.set(dir, list);
  }
  return Array.from(map.entries())
    .map(([dir, entries]) => ({
      dir,
      label: dir.split(/[\\/]/).filter(Boolean).pop() || dir,
      entries,
      songResults: entries.map(toSongResult)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

const selectedFolderGroup = computed(() => {
  if (!activeFolderDir.value) return folderGroups.value[0] || null;
  return folderGroups.value.find((g) => g.dir === activeFolderDir.value) || folderGroups.value[0] || null;
});

const activeSmartPlaylist = computed(
  () => smartPlaylists.value.find((sp) => sp.id === selectedSmartPlaylistId.value) || null
);

const smartMatchedTracks = computed(() => {
  if (!activeSmartPlaylist.value) return [];
  return evaluateSmartPlaylist(annotatedFilteredList.value, activeSmartPlaylist.value, trackPlayCounts.value);
});

const smartMatchedSongResults = computed(() => smartMatchedTracks.value.map(toSongResult));

const libraryCollageCovers = computed(() => {
  return filteredSongResults.value
    .map((s) => s.picUrl)
    .filter((u): u is string => Boolean(u))
    .slice(0, 12);
});

/** Label shown in the maintenance banner while a long task is running. */
const maintenanceLabel = computed(() => {
  if (localMusicStore.buildingFingerprints) return 'Building the acoustic index...';
  if (localMusicStore.autoTagging) return 'Looking up and writing metadata...';
  return t('localMusic.scanning');
});

const maintenanceDetail = computed(() => {
  if (localMusicStore.buildingFingerprints) {
    return `${localMusicStore.fingerprintProgress} / ${localMusicStore.fingerprintTotal} tracks analysed`;
  }
  if (localMusicStore.autoTagging) {
    return `${localMusicStore.autoTagProgress} / ${localMusicStore.autoTagTotal} tracks processed`;
  }
  return t('localMusic.songCount', { count: localMusicStore.scanProgress });
});

// ==================== Methods ====================

/**
 */
async function handleAddFolder(): Promise<void> {
  try {
    const result = await window.api.selectDirectory();
    if (result && !result.canceled && result.filePaths?.length > 0) {
      localMusicStore.addFolder(result.filePaths[0]);
      await localMusicStore.scanFolders();
    }
  } catch (error) {
    console.error('Failed to choose folder:', error);
    message.error(String(error));
  }
}

/**
 */
async function handleRemoveFolder(folder: string): Promise<void> {
  await localMusicStore.removeFolder(folder);
}

function triggerIngest(): void {
  debounceIngestLocalTracks(localMusicStore.musicList, (entry, candidate) => {
    const n = notification.info({
      title: 'Possible Duplicate Track',
      content: `"${entry.title}" might be a duplicate of "${candidate.title}". Merge into one song?`,
      duration: 10000,
      action: () =>
        h('div', { class: 'flex items-center gap-2 mt-2' }, [
          h(
            NButton,
            {
              size: 'tiny',
              type: 'primary',
              onClick: async () => {
                const { ingestLocalTrack, mergeSongs } = await import('@/services/songLibrary');
                const ext = entry.filePath.split('.').pop()?.toLowerCase();
                const newRes = await ingestLocalTrack(
                  {
                    path: entry.filePath,
                    title: entry.title,
                    artist: entry.artist || '',
                    album: entry.album || '',
                    durationSec: Math.round(
                      (entry.duration || 0) > 1000 ? entry.duration / 1000 : entry.duration || 0
                    ),
                    bitrate: (entry as any).bitrate,
                    container: ext
                  },
                  { forceNew: true }
                );
                await mergeSongs(candidate.id, newRes.songId);
                message.success('Tracks merged');
                n.destroy();
              }
            },
            { default: () => 'Merge' }
          ),
          h(
            NButton,
            {
              size: 'tiny',
              onClick: async () => {
                const { ingestLocalTrack } = await import('@/services/songLibrary');
                const ext = entry.filePath.split('.').pop()?.toLowerCase();
                await ingestLocalTrack(
                  {
                    path: entry.filePath,
                    title: entry.title,
                    artist: entry.artist || '',
                    album: entry.album || '',
                    durationSec: Math.round(
                      (entry.duration || 0) > 1000 ? entry.duration / 1000 : entry.duration || 0
                    ),
                    bitrate: (entry as any).bitrate,
                    container: ext
                  },
                  { forceNew: true }
                );
                message.info('Kept separate');
                n.destroy();
              }
            },
            { default: () => 'Keep separate' }
          )
        ])
    });
  });
}

/**
 */
async function handleScan(): Promise<void> {
  if (localMusicStore.folderPaths.length === 0) {
    await localMusicStore.scanFolders();
    triggerIngest();
    await handleAddFolder();
    return;
  }
  await localMusicStore.scanFolders();
  triggerIngest();
}

/**
 */
async function handlePlaySong(song: SongResult, contextList?: SongResult[]): Promise<void> {
  try {
    playerStore.prepareSongPlayback(song, contextList || filteredSongResults.value);
    await playerStore.setPlay(song);
  } catch (error) {
    console.error('Failed to play local music:', error);
  }
}

async function playSongBatch(songs: SongResult[]): Promise<void> {
  if (!songs || songs.length === 0) return;
  playerStore.setPlayList(songs);
  await playerStore.setPlay(songs[0]);
}

/**
 */
async function handleRemoveSong(id: number | string): Promise<void> {
  try {
    await localMusicStore.removeEntry(String(id));
    message.success(t('localMusic.removedFromLibrary'));
  } catch (error) {
    console.error('Failed to remove local song:', error);
    message.error(String(error));
  }
}

/**
 */
async function handlePlayAll(): Promise<void> {
  if (filteredSongResults.value.length === 0) return;

  try {
    const firstSong = filteredSongResults.value[0];
    const entry = filteredList.value[0];

    const exists = await window.api.checkFileExists(entry.filePath);
    if (!exists) {
      message.error(t('localMusic.fileNotFound'));
      return;
    }

    playerStore.setPlayList(filteredSongResults.value);
    await playerStore.setPlay(firstSong);
  } catch (error) {
    console.error('Failed to play all:', error);
  }
}

// ==================== Lifecycle ====================
onMounted(async () => {
  refreshPlayCounts();
  await Promise.all([loadAnnotations(), refreshSmartPlaylists()]);
  if (localMusicStore.scanning) {
    return;
  }
  await localMusicStore.loadFromCache();
  triggerIngest();
});

watch(
  () => [playerStore.playMusic?.id, showListeningStats.value],
  () => {
    refreshPlayCounts();
  }
);
</script>

<style scoped>
.song-virtual-list {
  @apply w-full;
}

.song-virtual-list :deep(.n-virtual-list__scroll) {
  scrollbar-width: thin;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar {
  width: 6px;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar-thumb {
  @apply bg-neutral-300 dark:bg-neutral-700 rounded-full;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar-track {
  @apply bg-transparent;
}
</style>
