# 使い方
### 1 まずこのリポジトリをWebstormやVSCodeでクローンします
### 2 そしたらnpmでpackage.jsonをすべてインストールします
### 3 インストールが終わったら、以下のファイルの内容にあるものを適切に設定してください
CaptchaPanel.js | ChannelIDと、ロールIDを適切にセットしてください 
### 4 Main.jsをRunして起動します

# カスタマイズの方法
たとえばBadNameチェックを消したい場合、Main.jsの以下を消します
const BadName = require('./user/BadName.js');
client.badname = new BadName(client);

コマンド類も同じような形です