import moduleAlias from 'module-alias';
import path from 'path';

// Register path aliases for production runtime
// This must be imported before any modules that use @ imports
moduleAlias.addAliases({
  '@': path.join(__dirname),
  '@/config': path.join(__dirname, 'config'),
  '@/types': path.join(__dirname, 'types'),
  '@/services': path.join(__dirname, 'services'),
  '@/models': path.join(__dirname, 'models'),
  '@/utils': path.join(__dirname, 'utils'),
  '@/routes': path.join(__dirname, 'routes'),
  '@/workers': path.join(__dirname, 'workers'),
});

export default moduleAlias;