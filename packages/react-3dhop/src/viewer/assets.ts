const CSS_RESOURCES = ['stylesheet/3dhop.css'];

const SCRIPT_RESOURCES = [
  'js/spidergl.js',
  'js/presenter.js',
  'js/nexus.js',
  'js/ply.js',
  'js/trackball_turntable.js',
  'js/trackball_turntable_pan.js',
  'js/trackball_pantilt.js',
  'js/trackball_sphere.js',
  'js/trackball_rail.js',
  'js/init.js'
];

const cssPromises = new Map<string, Promise<void>>();
const scriptPromises = new Map<string, Promise<void>>();

function loadCssOnce(href: string): Promise<void> {
  if (cssPromises.has(href)) {
    return cssPromises.get(href)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    if (document.querySelector(`link[data-3dhop-source="${href}"]`)) {
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-3dhop-source', href);
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
    document.head.appendChild(link);
  });

  cssPromises.set(href, promise);
  return promise;
}

function loadScriptOnce(src: string): Promise<void> {
  if (scriptPromises.has(src)) {
    return scriptPromises.get(src)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-3dhop-source="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = src;
    script.async = false;
    script.setAttribute('data-3dhop-source', src);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });

  scriptPromises.set(src, promise);
  return promise;
}

export async function ensureAssets(baseUrl: string): Promise<void> {
  await Promise.all(CSS_RESOURCES.map((file) => loadCssOnce(`${baseUrl}/${file}`)));
  for (const file of SCRIPT_RESOURCES) {
    // Sequential load keeps execution order identical to the static HTML bootstrap.
    // eslint-disable-next-line no-await-in-loop
    await loadScriptOnce(`${baseUrl}/${file}`);
  }
}
