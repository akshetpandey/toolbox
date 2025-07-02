import eslint from '@eslint/js'
import pluginReact from 'eslint-plugin-react'
import pluginRouter from '@tanstack/eslint-plugin-router'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config(
  globalIgnores(['dist/*']),
  ...pluginRouter.configs['flat/recommended'],
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  pluginReact.configs.flat['jsx-runtime'],
  {
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js'],
        },
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
)
