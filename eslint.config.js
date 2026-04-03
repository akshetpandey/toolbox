import globals from 'globals'
import eslint from '@eslint/js'
import pluginReact from 'eslint-plugin-react'
import pluginRouter from '@tanstack/eslint-plugin-router'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig(
  globalIgnores(['dist/*', 'scripts/*']),
  ...pluginRouter.configs['flat/recommended'],
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  pluginReact.configs.flat['jsx-runtime'],
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js'],
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        // Workaround for eslint-plugin-react compat with eslint 10
        // Change to 'detect' after eslint-plugin-react supports eslint 10+
        version: '19',
      },
    },
  },
)
