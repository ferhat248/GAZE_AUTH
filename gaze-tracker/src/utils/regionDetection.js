export const REGIONS = {
  'top-left':     { label: 'Fırat Üniversitesi',     icon: '🎓', color: '#f59e0b', url: 'https://www.firat.edu.tr'          },
  'top-right':    { label: 'Google',                 icon: '🔍', color: '#3b82f6', url: 'https://www.google.com'            },
  'bottom-left':  { label: 'Adli Bilişim Müh.',      icon: '🔬', color: '#8b5cf6', url: 'https://adlibilisim.firat.edu.tr'  },
  'bottom-right': { label: 'VirusTotal',             icon: '🛡️', color: '#10b981', url: 'https://www.virustotal.com'        },
};

export function detectRegion(x, y) {
  const cx = window.innerWidth  / 2;
  const cy = window.innerHeight / 2;
  if (x < cx && y < cy) return 'top-left';
  if (x >= cx && y < cy) return 'top-right';
  if (x < cx && y >= cy) return 'bottom-left';
  return 'bottom-right';
}

export function getRegionRect(regionKey) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const hw = W / 2;
  const hh = H / 2;
  switch (regionKey) {
    case 'top-left':     return { x: 0,  y: 0,  w: hw, h: hh };
    case 'top-right':    return { x: hw, y: 0,  w: hw, h: hh };
    case 'bottom-left':  return { x: 0,  y: hh, w: hw, h: hh };
    case 'bottom-right': return { x: hw, y: hh, w: hw, h: hh };
    default:             return null;
  }
}
