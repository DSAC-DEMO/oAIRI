export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-10 bg-blue-200 border-t border-blue-300 px-6 py-3 text-center">
      <p className="text-xs text-white leading-relaxed">
        pAIRI v3.0 is licensed under{' '}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-100 transition-colors"
        >
          Creative Commons Attribution 4.0 International (CC&nbsp;BY&nbsp;4.0)
        </a>
        {' '}·{' '}Supported by DSAC{' '}·{' '}AI Readiness framework by AI Singapore (AISG)
      </p>
    </footer>
  );
}
