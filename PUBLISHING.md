# GitHub Pagesの更新

公開先: https://sagamienglish.github.io/pronunciation-master/

GitHub Pagesはgh-pagesブランチのルートを配信します。mainブランチにアプリのソース、テスト、音声生成スクリプトがあります。

変更してテストを通した後、mainをコミットして次のコマンドで更新します。

```sh
npm test
git push origin main
git subtree split --prefix dist -b pages-update
git push origin pages-update:gh-pages
git branch -D pages-update
```

教材PDFや個人の練習記録をGitへ追加しないでください。Lesson 8以降の追加はREADMEの手順を参照してください。
