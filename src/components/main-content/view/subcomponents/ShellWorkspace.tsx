import { useEffect, useMemo, useState } from 'react';
import { Plus, Terminal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import StandaloneShell from '../../../StandaloneShell';
import type { Project } from '../../../../types/app';

type ShellWorkspaceProps = {
  project: Project;
};

type ShellInstance = {
  id: string;
  title: string;
};

const AnyStandaloneShell = StandaloneShell as any;
const STORAGE_KEY_PREFIX = 'shell-workspace-state:';

const createShellId = () =>
  `shell-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeShells = (value: unknown): ShellInstance[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is ShellInstance => (
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as ShellInstance).id === 'string' &&
      typeof (item as ShellInstance).title === 'string'
    ))
    .map((item) => ({
      id: item.id,
      title: item.title,
    }));
};

export default function ShellWorkspace({ project }: ShellWorkspaceProps) {
  const { t } = useTranslation('chat');

  const storageKey = useMemo(() => {
    const projectKey = project.fullPath || project.path || project.name;
    return `${STORAGE_KEY_PREFIX}${projectKey}`;
  }, [project.fullPath, project.path, project.name]);

  const createShellInstance = (index: number): ShellInstance => ({
    id: createShellId(),
    title: t('shell.workspace.tabTitle', { index }),
  });

  const createInitialWorkspace = () => {
    const initialShell = createShellInstance(1);
    return {
      shells: [initialShell],
      activeShellId: initialShell.id,
    };
  };

  const loadWorkspaceState = () => {
    if (typeof window === 'undefined') {
      return createInitialWorkspace();
    }

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        return createInitialWorkspace();
      }

      const parsed = JSON.parse(stored) as { shells?: unknown; activeShellId?: unknown };
      const storedShells = normalizeShells(parsed?.shells);
      if (storedShells.length === 0) {
        return createInitialWorkspace();
      }

      const storedActiveShellId = typeof parsed?.activeShellId === 'string' ? parsed.activeShellId : null;
      const activeShellId = storedShells.some((shell) => shell.id === storedActiveShellId)
        ? storedActiveShellId!
        : storedShells[0].id;

      return {
        shells: storedShells,
        activeShellId,
      };
    } catch {
      return createInitialWorkspace();
    }
  };

  const [initialWorkspaceState] = useState(() => loadWorkspaceState());
  const [shells, setShells] = useState<ShellInstance[]>(initialWorkspaceState.shells);
  const [activeShellId, setActiveShellId] = useState<string>(initialWorkspaceState.activeShellId);

  useEffect(() => {
    const nextState = loadWorkspaceState();
    setShells(nextState.shells);
    setActiveShellId(nextState.activeShellId);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify({
      shells,
      activeShellId,
    }));
  }, [storageKey, shells, activeShellId]);

  const handleAddShell = () => {
    const nextShell = createShellInstance(shells.length + 1);
    setShells((prev) => [...prev, nextShell]);
    setActiveShellId(nextShell.id);
  };

  const handleCloseShell = (shellId: string) => {
    setShells((prev) => {
      if (prev.length === 1) {
        const replacementShell = createShellInstance(1);
        setActiveShellId(replacementShell.id);
        return [replacementShell];
      }

      const closingIndex = prev.findIndex((shell) => shell.id === shellId);
      const nextShells = prev.filter((shell) => shell.id !== shellId);

      if (activeShellId === shellId) {
        const fallbackShell = nextShells[Math.max(0, closingIndex - 1)] || nextShells[0];
        if (fallbackShell) {
          setActiveShellId(fallbackShell.id);
        }
      }

      return nextShells;
    });
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="border-b border-gray-800 bg-gray-950/80 px-2 py-2">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
          {shells.map((shell) => {
            const isActive = shell.id === activeShellId;

            return (
              <div
                key={shell.id}
                className={`group flex items-center gap-1 rounded-lg border px-2 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'border-blue-500/40 bg-blue-500/15 text-white'
                    : 'border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700 hover:bg-gray-800/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveShellId(shell.id)}
                  className="flex items-center gap-2 whitespace-nowrap"
                  title={shell.title}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  <span>{shell.title}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCloseShell(shell.id)}
                  className="rounded p-0.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={t('shell.workspace.closeShell', { title: shell.title })}
                  title={t('shell.workspace.closeShell', { title: shell.title })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddShell}
            className="ml-1 inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-700 px-2 py-1.5 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:bg-gray-800 hover:text-white"
            aria-label={t('shell.workspace.newShell')}
            title={t('shell.workspace.newShell')}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('shell.workspace.newShell')}</span>
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        {shells.map((shell) => {
          const isActive = shell.id === activeShellId;

          return (
            <div
              key={shell.id}
              className={`absolute inset-0 ${isActive ? 'z-10 opacity-100' : 'pointer-events-none opacity-0'}`}
            >
              <AnyStandaloneShell
                project={project}
                session={null}
                isPlainShell={true}
                shellInstanceId={shell.id}
                showHeader={false}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
