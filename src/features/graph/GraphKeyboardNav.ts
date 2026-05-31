import { useEffect } from 'react';
import Sigma from 'sigma';
import Graph from 'graphology';
import { Entity } from '../../lib/validation';
import { IRepository } from '../../db/repository';
import { removeFromSearchIndex } from '../../lib/search';
import { logger } from '../../lib/logger';

export function useGraphKeyboardNavigation(
  container: HTMLDivElement | null,
  sigmaInstance: Sigma | null,
  graph: Graph,
  entities: Entity[],
  selectedNode: string | null,
  setSelectedNode: (node: string | null) => void,
  focusRingIndex: number,
  setFocusRingIndex: (index: number) => void,
  repository: IRepository
) {
  useEffect(() => {
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!sigmaInstance) return;

      const nodes = graph.nodes();
      const visibleNodes = nodes.filter(n => n !== 'placeholder');
      const currentIdx = selectedNode ? visibleNodes.indexOf(selectedNode) : focusRingIndex;

      // Arrow keys with modifier = pan camera
      const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey;

      switch (e.key) {
        case 'Tab': {
          e.preventDefault();
          const dir = e.shiftKey ? -1 : 1;
          const next = ((currentIdx + dir) % visibleNodes.length + visibleNodes.length) % visibleNodes.length;
          if (visibleNodes[next]) {
            setSelectedNode(visibleNodes[next]);
            setFocusRingIndex(next);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (hasModifier) {
            const camera = sigmaInstance.getCamera();
            camera.setState({ x: camera.x + 50 / camera.ratio });
          } else if (selectedNode) {
            const neighbors = graph.neighbors(selectedNode);
            if (neighbors.length > 0) {
              setSelectedNode(neighbors[neighbors.length - 1]);
            }
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (hasModifier) {
            const camera = sigmaInstance.getCamera();
            camera.setState({ x: camera.x - 50 / camera.ratio });
          } else if (selectedNode) {
            const neighbors = graph.neighbors(selectedNode);
            if (neighbors.length > 0) {
              setSelectedNode(neighbors[0]);
            }
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (hasModifier) {
            const camera = sigmaInstance.getCamera();
            camera.setState({ y: camera.y + 50 / camera.ratio });
          } else if (visibleNodes.length > 0) {
            const dir = -1;
            const next = ((currentIdx + dir) % visibleNodes.length + visibleNodes.length) % visibleNodes.length;
            if (visibleNodes[next]) {
              setSelectedNode(visibleNodes[next]);
              setFocusRingIndex(next);
            }
          }
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (hasModifier) {
            const camera = sigmaInstance.getCamera();
            camera.setState({ y: camera.y - 50 / camera.ratio });
          } else if (visibleNodes.length > 0) {
            const dir = 1;
            const next = ((currentIdx + dir) % visibleNodes.length + visibleNodes.length) % visibleNodes.length;
            if (visibleNodes[next]) {
              setSelectedNode(visibleNodes[next]);
              setFocusRingIndex(next);
            }
          }
          break;
        }
        case '=':
        case '+': {
          e.preventDefault();
          const camera = sigmaInstance.getCamera();
          camera.setState({ ratio: camera.ratio * 0.8 });
          break;
        }
        case '-': {
          e.preventDefault();
          const camera = sigmaInstance.getCamera();
          camera.setState({ ratio: camera.ratio / 0.8 });
          break;
        }
        case 'Home': {
          e.preventDefault();
          void sigmaInstance.getCamera().animatedReset({ duration: 300 });
          break;
        }
        case 'Enter':
        case ' ': {
          if (visibleNodes.length > 0 && currentIdx >= 0 && visibleNodes[currentIdx]) {
            setSelectedNode(visibleNodes[currentIdx]);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setSelectedNode(null);
          setFocusRingIndex(-1);
          break;
        }
        case 'Delete':
        case 'Backspace': {
          if (selectedNode && window.confirm(`Delete "${entities.find(e => e.id === selectedNode)?.name}"? This will also delete all claims and links for this entity.`)) {
            void repository.deleteEntity(selectedNode).then(() => {
              void removeFromSearchIndex(selectedNode);
              logger.info('Entity deleted via keyboard', { id: selectedNode });
              setSelectedNode(null);
            }).catch(err => logger.error('Failed to delete entity', err));
          }
          break;
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [container, sigmaInstance, graph, entities, selectedNode, setSelectedNode, focusRingIndex, setFocusRingIndex, repository]);
}
