import moduleAlias from 'module-alias';
import path from 'path';

// Register path aliases for production runtime
// This must be imported before any modules that use @ imports

// In production, __dirname points to the dist directory where compiled JS files are
// In development with ts-node, it points to the src directory
const isCompiled = __filename.endsWith('.js');
const baseDir = isCompiled ? __dirname : path.join(__dirname, '../dist');

moduleAlias.addAliases({
  '@': baseDir,
  '@/config': path.join(baseDir, 'config'),
  '@/types': path.join(baseDir, 'types'),
  '@/services': path.join(baseDir, 'services'),
  '@/models': path.join(baseDir, 'models'),
  '@/utils': path.join(baseDir, 'utils'),
  '@/routes': path.join(baseDir, 'routes'),
  '@/workers': path.join(baseDir, 'workers'),
});

export default moduleAlias;