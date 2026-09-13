/** Trailers that must never appear (AI attribution, see COMMIT-RULES). Matched case-insensitively. */
const DISALLOWED_TRAILERS = ['Co-authored-by', 'Generated with', 'Made-with'];

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'footer-disallowed-trailer': (parsed, when = 'always', value = DISALLOWED_TRAILERS) => {
          const names = Array.isArray(value) ? value : [value];
          const text = `${parsed.body ?? ''}\n${parsed.footer ?? ''}`;
          const hit = names.find((name) => new RegExp(`^\\s*${name}\\s*:`, 'im').test(text));
          const passes = when === 'never' ? Boolean(hit) : !hit;
          return [
            passes,
            hit
              ? `commit message must not contain a "${hit}:" trailer`
              : 'commit message must contain a disallowed trailer',
          ];
        },
      },
    },
  ],
  rules: {
    'body-max-length': [2, 'always', 0],
    'footer-disallowed-trailer': [2, 'always', DISALLOWED_TRAILERS],
    'footer-max-length': [0],
  },
};
