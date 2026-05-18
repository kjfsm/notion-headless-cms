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

function ErrorDetail({
  err,
  depth = 0,
}: {
  err: Record<string, unknown>;
  depth?: number;
}) {
  const message = String(err["message"] ?? "");
  const code = err["code"] != null ? String(err["code"]) : null;
  const stack = err["stack"] != null ? String(err["stack"]) : null;
  const cause = err["cause"] as Record<string, unknown> | null | undefined;
  return (
    <div style={{ marginLeft: depth * 16 }}>
      {code && <p>コード: {code}</p>}
      <p>{message}</p>
      {stack && (
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8em" }}>{stack}</pre>
      )}
      {cause && (
        <>
          <p>
            <strong>原因:</strong>
          </p>
          <ErrorDetail err={cause} depth={depth + 1} />
        </>
      )}
    </div>
  );
}

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
    // data() で投げた構造化エラー（{ message, code, stack, cause }）と通常の data("Not Found") 両方を処理する
    const d = error.data as Record<string, unknown> | string | null;
    if (d && typeof d === "object") {
      return (
        <html lang="ja">
          <head>
            <title>{error.status} エラー</title>
          </head>
          <body>
            <h1>エラーが発生しました ({error.status})</h1>
            <ErrorDetail err={d} />
          </body>
        </html>
      );
    }
    return (
      <html lang="ja">
        <head>
          <title>{error.status} エラー</title>
        </head>
        <body>
          <h1>{error.status}</h1>
          <p>{String(d ?? error.statusText)}</p>
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
