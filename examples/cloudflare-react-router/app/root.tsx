import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";
import "./app.css";

export default function App() {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <html lang="ja">
        <head>
          <title>{error.status} エラー</title>
        </head>
        <body>
          <h1>{error.status}</h1>
          <p>{String(error.data)}</p>
        </body>
      </html>
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  const code = (error as Record<string, unknown>)["code"];
  const stack = error instanceof Error ? error.stack : undefined;

  return (
    <html lang="ja">
      <head>
        <title>エラー</title>
      </head>
      <body>
        <h1>エラーが発生しました</h1>
        {code != null && <p>コード: {String(code)}</p>}
        <p>{message}</p>
        {stack != null && (
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8em" }}>
            {stack}
          </pre>
        )}
      </body>
    </html>
  );
}
