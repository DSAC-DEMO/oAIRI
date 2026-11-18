export default function Footer() {
  return (
    <footer className="relative sm:fixed bottom-0 left-0 right-0 z-10 bg-green-700 border-t border-green-800 px-4 sm:px-6 py-1.5 text-center flex-shrink-0">
      <p className="text-xs text-white leading-tight">
        oAIRI 3.0 is licensed under{' '}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-green-100 transition-colors"
        >
          CC&nbsp;BY&nbsp;4.0
        </a>
        . By AI Singapore. Supported by SP DSAC.
      </p>
    </footer>
  );
}
