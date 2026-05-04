# example-cloudflare-react-router

## 0.0.33

### Patch Changes

- Updated dependencies [a82db83]
  - @notion-headless-cms/notion-orm@0.1.18
  - @notion-headless-cms/react-renderer@0.0.4

## 0.0.32

### Patch Changes

- Updated dependencies [1501e16]
  - @notion-headless-cms/react-renderer@0.0.3

## 0.0.31

### Patch Changes

- Updated dependencies [2257467]
  - @notion-headless-cms/core@0.3.17
  - @notion-headless-cms/notion-orm@0.1.17
  - @notion-headless-cms/react-renderer@0.0.2
  - @notion-headless-cms/cache@0.0.10

## 0.0.30

### Patch Changes

- Updated dependencies [01fa3f3]
- Updated dependencies [a653d91]
- Updated dependencies [aa3b1d5]
  - @notion-headless-cms/notion-embed@0.1.6
  - @notion-headless-cms/renderer@0.1.8
  - @notion-headless-cms/react-renderer@0.0.1
  - @notion-headless-cms/notion-orm@0.1.16
  - @notion-headless-cms/core@0.3.16
  - @notion-headless-cms/cache@0.0.9

## 0.0.29

### Patch Changes

- Updated dependencies [71702e6]
  - @notion-headless-cms/core@0.3.15
  - @notion-headless-cms/renderer@0.1.7
  - @notion-headless-cms/notion-orm@0.1.15
  - @notion-headless-cms/cache@0.0.8
  - @notion-headless-cms/notion-embed@0.1.5

## 0.0.28

### Patch Changes

- Updated dependencies [63f5f38]
  - @notion-headless-cms/core@0.3.14
  - @notion-headless-cms/cache@0.0.7
  - @notion-headless-cms/notion-orm@0.1.14

## 0.0.27

### Patch Changes

- Updated dependencies [1bae29d]
  - @notion-headless-cms/cache@0.0.6

## 0.0.26

### Patch Changes

- efca5a2: cloudflare 系 example のデプロイ設定を整備。各 `wrangler.toml` の `[build]` コマンドに `nhc generate` を組み込み、Cloudflare GitHub App（Workers Builds）からそのままビルド・デプロイできるようにした。GitHub Actions 側にも `workflow_dispatch` で起動できる `deploy-examples-cloudflare.yml` を追加し、`example` 選択 + `dry-run` に対応。`cloudflare-hono` には no-op の `build` スクリプトを追加して 4 example のフローを統一。

## 0.0.25

### Patch Changes

- Updated dependencies [45ee864]
- Updated dependencies [84a5639]
- Updated dependencies [c75218d]
- Updated dependencies [c75218d]
- Updated dependencies [c75218d]
  - @notion-headless-cms/core@0.3.13
  - @notion-headless-cms/notion-orm@0.1.13
  - @notion-headless-cms/notion-embed@0.1.4
  - @notion-headless-cms/cache@0.0.5

## 0.0.24

### Patch Changes

- Updated dependencies [bccd931]
  - @notion-headless-cms/core@0.3.12
  - @notion-headless-cms/notion-orm@0.1.12
  - @notion-headless-cms/cache@0.0.4

## 0.0.23

### Patch Changes

- Updated dependencies [757c7e3]
  - @notion-headless-cms/core@0.3.11
  - @notion-headless-cms/cache@0.0.3
  - @notion-headless-cms/notion-orm@0.1.11

## 0.0.22

### Patch Changes

- Updated dependencies [451b6fd]
- Updated dependencies [24bf322]
  - @notion-headless-cms/notion-embed@0.1.3
  - @notion-headless-cms/core@0.3.10
  - @notion-headless-cms/notion-orm@0.1.10
  - @notion-headless-cms/cache@0.0.2

## 0.0.21

### Patch Changes

- Updated dependencies [dffa33b]
- Updated dependencies [17f4201]
  - @notion-headless-cms/notion-embed@0.1.2
  - @notion-headless-cms/core@0.3.9
  - @notion-headless-cms/cache@0.0.1
  - @notion-headless-cms/notion-orm@0.1.9
  - @notion-headless-cms/renderer@0.1.6

## 0.0.20

### Patch Changes

- Updated dependencies [e6d043b]
- Updated dependencies [ac7c5cc]
  - @notion-headless-cms/renderer@0.1.5
  - @notion-headless-cms/core@0.3.8
  - @notion-headless-cms/cache-r2@0.2.11
  - @notion-headless-cms/notion-orm@0.1.8

## 0.0.19

### Patch Changes

- Updated dependencies [5703a6c]
  - @notion-headless-cms/core@0.3.7
  - @notion-headless-cms/cache-r2@0.2.10
  - @notion-headless-cms/notion-orm@0.1.7

## 0.0.18

### Patch Changes

- Updated dependencies [68b01d7]
  - @notion-headless-cms/core@0.3.6
  - @notion-headless-cms/cache-r2@0.2.9
  - @notion-headless-cms/notion-orm@0.1.6

## 0.0.17

### Patch Changes

- Updated dependencies [233af88]
  - @notion-headless-cms/core@0.3.5
  - @notion-headless-cms/cache-r2@0.2.8
  - @notion-headless-cms/notion-orm@0.1.5

## 0.0.16

### Patch Changes

- Updated dependencies [83a5cca]
  - @notion-headless-cms/core@0.3.4
  - @notion-headless-cms/cache-r2@0.2.7
  - @notion-headless-cms/notion-orm@0.1.4

## 0.0.15

### Patch Changes

- Updated dependencies [e719435]
  - @notion-headless-cms/core@0.3.3
  - @notion-headless-cms/cache-r2@0.2.6
  - @notion-headless-cms/notion-orm@0.1.3

## 0.0.14

### Patch Changes

- Updated dependencies [7b06514]
  - @notion-headless-cms/core@0.3.2
  - @notion-headless-cms/notion-orm@0.1.2
  - @notion-headless-cms/cache-r2@0.2.5

## 0.0.13

### Patch Changes

- Updated dependencies [6f34d49]
  - @notion-headless-cms/renderer@0.1.4
  - @notion-headless-cms/notion-orm@0.1.1
  - @notion-headless-cms/core@0.3.1
  - @notion-headless-cms/cache-r2@0.2.4

## 0.0.12

### Patch Changes

- Updated dependencies [c955826]
  - @notion-headless-cms/core@0.3.0
  - @notion-headless-cms/notion-orm@0.1.0
  - @notion-headless-cms/cache-r2@0.2.3

## 0.0.11

### Patch Changes

- Updated dependencies [15d5091]
  - @notion-headless-cms/notion-orm@0.0.6

## 0.0.10

### Patch Changes

- Updated dependencies [1304c1b]
  - @notion-headless-cms/notion-orm@0.0.5

## 0.0.9

### Patch Changes

- Updated dependencies [cea9495]
  - @notion-headless-cms/core@0.2.1
  - @notion-headless-cms/notion-orm@0.0.4
  - @notion-headless-cms/cache-r2@0.2.2

## 0.0.8

### Patch Changes

- @notion-headless-cms/cache-r2@0.2.1

## 0.0.7

### Patch Changes

- Updated dependencies [ebf56ea]
  - @notion-headless-cms/notion-orm@0.0.3

## 0.0.6

### Patch Changes

- Updated dependencies [53a93f7]
- Updated dependencies [7791e88]
  - @notion-headless-cms/core@0.2.0
  - @notion-headless-cms/cache-r2@0.2.0
  - @notion-headless-cms/renderer@0.1.3
  - @notion-headless-cms/notion-orm@0.0.2

## 0.0.5

### Patch Changes

- Updated dependencies [19cb87a]
- Updated dependencies [0a938ab]
- Updated dependencies [7192646]
- Updated dependencies [f169f34]
- Updated dependencies [bb693f1]
  - @notion-headless-cms/core@0.1.3
  - @notion-headless-cms/adapter-cloudflare@0.2.0
  - @notion-headless-cms/notion-orm@0.0.1

## 0.0.4

### Patch Changes

- Updated dependencies [b453f2e]
  - @notion-headless-cms/adapter-cloudflare@0.1.3

## 0.0.3

### Patch Changes

- Updated dependencies [20b0cfc]
- Updated dependencies [6c36d76]
- Updated dependencies [5763f19]
  - @notion-headless-cms/adapter-cloudflare@0.1.2
  - @notion-headless-cms/source-notion@0.2.2

## 0.0.2

### Patch Changes

- 8f69e55: update
- Updated dependencies [8f69e55]
  - @notion-headless-cms/adapter-cloudflare@0.1.1
  - @notion-headless-cms/source-notion@0.2.1
