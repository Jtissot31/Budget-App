import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Web document shell — adds horizontal inset on narrow viewports.
 * RN Web tab scenes ignore padding/margin on React wrappers; CSS on #root is reliable.
 */
const MOBILE_WEB_SHELL_CSS = `
  #root {
    box-sizing: border-box;
    max-width: 100%;
    padding-left: 16px;
    padding-right: 16px;
  }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: MOBILE_WEB_SHELL_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
