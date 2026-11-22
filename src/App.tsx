import { reloadHudAmmo } from './hud/hudSignals';
import { resetRangeTargets, setRangeWeapon } from './range/useRangeTargets';
import { AppViewport } from './AppViewport';
import { RangeControlDock } from './ui/RangeControlDock';
import { RangeToolbar } from './ui/RangeToolbar';
import { useAppController } from './ui/useAppController';
import { ViewerSidebar } from './ui/ViewerSidebar';

export default function App() {
  const ctrl = useAppController();

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100"
      onDragOver={(e) => { if (ctrl.mode === 'viewer') e.preventDefault(); }}
      onDrop={ctrl.handleDrop}
    >
      <RangeToolbar
        mode={ctrl.mode}
        onModeChange={ctrl.handleModeChange}
        perspective={ctrl.perspective}
        onTogglePerspective={ctrl.handleTogglePerspective}
        dreamcast={ctrl.dreamcast}
        onUpdateDreamcast={ctrl.handleUpdateDreamcast}
        singleItemEditMode={ctrl.range.singleItemEditMode}
        activeWeapon={ctrl.range.activeWeapon}
        onSelectWeapon={setRangeWeapon}
        onReload={reloadHudAmmo}
        onResetTargets={resetRangeTargets}
      />

      {ctrl.mode === 'viewer' ? (
        <ViewerSidebar
          character={ctrl.character}
          onSelectCharacter={ctrl.handleSelectCharacter}
          onResetCustomGlb={ctrl.handleResetCustomGlb}
          customGlbName={ctrl.customGlbName}
          animations={ctrl.animations}
          activeAnim={ctrl.activeAnim}
          onSelectAnim={ctrl.setActiveAnim}
          triCount={ctrl.triCount}
          boneCount={ctrl.boneCount}
          wireframe={ctrl.wireframe}
          onToggleWireframe={ctrl.setWireframe}
          showSockets={ctrl.showSockets}
          onToggleSockets={ctrl.setShowSockets}
          customAlbedoUrl={ctrl.customAlbedoUrl}
          onResetAlbedo={ctrl.handleResetAlbedo}
        />
      ) : null}

      <main className="relative min-w-0 min-h-0 flex-1 overflow-hidden">
        <AppViewport
          initialMode={ctrl.initialMode}
          mode={ctrl.mode}
          rangeMounted={ctrl.rangeMounted}
          perspective={ctrl.perspective}
          onPerspectiveChange={ctrl.setPerspective}
          dreamcast={ctrl.dreamcast}
          character={ctrl.character}
          customGlbUrl={ctrl.customGlbUrl}
          activeAnim={ctrl.activeAnim}
          wireframe={ctrl.wireframe}
          showSockets={ctrl.showSockets}
          customAlbedoUrl={ctrl.customAlbedoUrl}
          onViewerLoaded={ctrl.handleLoaded}
        />

        {ctrl.mode === 'range' ? (
          <>
            <RangeControlDock />
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <div className="rounded-md border border-zinc-800/80 bg-zinc-950/75 px-3 py-1 text-[11px] font-mono text-zinc-300 backdrop-blur-sm">
                WASD / Arrows: Move · Shift: Sprint · Space: Jump · V: 1st/3rd · Click: Aim · Esc: Unlock
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
