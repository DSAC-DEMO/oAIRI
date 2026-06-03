export default function Footer() {
  return (
    <footer className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-3 text-center">
      <p className="text-xs text-gray-400 leading-relaxed">
        pAIRI v3.0 is licensed under{' '}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-500 transition-colors"
        >
          Creative Commons Attribution 4.0 International (CC&nbsp;BY&nbsp;4.0)
        </a>
        {' '}·{' '}Supported by DSAC{' '}·{' '}AI Readiness framework by AI Singapore (AISG)
      </p>
    </footer>
  );
}
