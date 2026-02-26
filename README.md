## ステートマシンの作成

- 空白から作成
- ステートマシン名：`sfn-order-system`
- ステートマシンのタイプ：`Express`

## フローの作成

- Pass（変数定義）
- DynamoDB: GetItem（在庫確認）
- Choice（在庫有無）
- Fail（在庫無し）
- Parallel
- DynamoDB: UpdateItem（在庫更新）
- DynamoDB: PutItem（注文追加）
- Pass（決済。あとで外部API呼び出しに置き換え）
- Choice（決済成否）
- Fail（決済失敗）
- Parallel（決済失敗）
- DynamoDB: UpdateItem（在庫巻き戻し）
- DynamoDB: UpdateItem（注文失敗）
- Pass（メール送信。あとでSESに置き換え）
- DynamoDB: UpdateItem（注文成功）

### DynamoDB作成

#### 商品テーブル

（テーブルの作成）

- テーブル名：`sfn-shop-items`
- パーティションキー：`id`

（項目を作成）

```
{
  "id": {
    "S": "abc"
  },
  "name": {
    "S": "ロゴTシャツ"
  },
  "price": {
    "N": "1000"
  },
  "quantity": {
    "N": "10"
  }
}
```

### 注文テーブル

- テーブル名：`sfn-shop-orders`
- パーティションキー：`id`

### Pass（変数定義）

- 状態名：`変数定義`
- 出力：`設定不要`
- 変数：

```
{
  "executionId": "{% $states.context.Execution.Id %}",
  "userName": "{% $states.input.userName %}",
  "userEmail": "{% $states.input.userEmail %}",
  "cardNumber": "{% $states.input.cardNumber %}",
  "itemId": "{% $states.input.items[0].itemId %}",
  "quantity": "{% $states.input.items[0].quantity %}"
}
```

インプットのイメージ ↓

話を単純にするために単一の商品のみ扱う。配列にしてるのは拡張性を考えたため

```
{
  "userName": "代々木二郎",
  "userEmail": "hoge@fuga.com",
  "cardNumber": "1234-1234-1234-1234",
  "items": [
    {
      "itemId": "abc",
      "quantity": 1
    }
  ]
}
```

### DynamoDB: GetItem（在庫確認）

- 状態名：`在庫確認`
- 引数と出力：

引数

```
{
  "TableName": "sfn-shop-items",
  "Key": {
    "id": {
      "S": "{% $itemId %}"
    }
  }
}
```

- 変数：

IDを元に取得した商品名と価格を取得して変数に保存

```
{
  "itemName": "{% $states.result.Item.name.S %}",
  "itemPrice": "{% $number($states.result.Item.price.N) %}"
}
```

### Choice（在庫有無）

- 状態名：`在庫有無`
- Choice Rules - Rule #1

```
{% $number($states.input.Item.quantity.N) - $quantity > 0 %}
```

### Fail（在庫無し）

- 状態名：`在庫無し`
- Error - オプション

```
在庫がありません
```

### Parallel

変更不要

### DynamoDB: UpdateItem（在庫更新）

- 状態名：`在庫更新`
- 引数と出力：

引数

```
{
  "TableName": "sfn-shop-items",
  "Key": {
    "id": {
      "S": "{% $itemId %}"
    }
  },
  "UpdateExpression": "SET #quantity = #quantity - :val",
  "ExpressionAttributeNames": {
    "#quantity": "quantity"
  },
  "ExpressionAttributeValues": {
    ":val": {
      "N": "{% $string($quantity) %}"
    }
  }
}
```

### DynamoDB: PutItem（注文追加）

- 状態名：`注文追加`
- 引数と出力：

引数

```
{
  "TableName": "sfn-shop-orders",
  "Item": {
    "id": {
      "S": "{% $executionId %}"
    },
    "status": {
      "S": "PROCESSING"
    },
    "userEmail": {
      "S": "{% $userEmail %}"
    },
    "createdAt": {
      "S": "{% $now() %}"
    }
  }
}
```

### Pass（決済。あとで外部API呼び出しに置き換え）

- 状態名：`決済`
- 出力：

```
{
  "success": true
}
```

### Choice（決済成否）

- 状態名：`決済成功可否`
- Choice Rules - Rule #1

```
{% $states.input.success %}
```

### Fail（決済失敗）

- 状態名：`決済失敗`
- Error - オプション

```
決済に失敗しました
```

### Parallel（決済失敗）

- 状態名：`DB更新`

### DynamoDB: UpdateItem（在庫巻き戻し）

- 状態名：`在庫巻き戻し`
- 引数と出力：

```
{
  "TableName": "sfn-shop-items",
  "Key": {
    "id": {
      "S": "{% $itemId %}"
    }
  },
  "UpdateExpression": "SET #quantity = #quantity + :val",
  "ExpressionAttributeNames": {
    "#quantity": "quantity"
  },
  "ExpressionAttributeValues": {
    ":val": {
      "N": "{% $string($quantity) %}"
    }
  }
}
```

### DynamoDB: UpdateItem（注文失敗）

- 状態名：`注文失敗`
- 引数と出力：

```
{
  "TableName": "sfn-shop-orders",
  "Key": {
    "id": {
      "S": "{% $executionId %}"
    }
  },
  "UpdateExpression": "SET #status = :status",
  "ExpressionAttributeNames": {
    "#status": "status"
  },
  "ExpressionAttributeValues": {
    ":status": {
      "S": "FAILED"
    }
  }
}
```

### Pass（メール送信。あとでSESに置き換え）

- 状態名：`注文完了メール送信`

### DynamoDB: UpdateItem（注文成功）

- 状態名：`注文成功`
- 引数と出力：

```
{
  "TableName": "sfn-shop-orders",
  "Key": {
    "id": {
      "S": "{% $executionId %}"
    }
  },
  "UpdateExpression": "SET #status = :status",
  "ExpressionAttributeNames": {
    "#status": "status"
  },
  "ExpressionAttributeValues": {
    ":status": {
      "S": "SUCCEEDED"
    }
  }
}
```

### ステートマシーンの実行

入力 - オプション

```json
{
  "userName": "代々木二郎",
  "userEmail": "hoge@fuga.com",
  "cardNumber": "1234-1234-1234-1234",
  "items": [
    {
      "itemId": "abc",
      "quantity": 1
    }
  ]
}
```

## SESの作成

### ステートの置き換え（Step Functions）

- Pass → SES V2: SendEmail
- 状態名：`注文完了メール送信`

### SESでIDを作成（SES）

「設定」→「ID」→「IDの作成」

- IDタイプ：`Eメールアドレス`
- 「ID」の作成
- ↑ Eメールアドレスを確認。有効化

※ お店側のメールとユーザーのメールを想定して2つ登録

### 引数と出力（Step Functions）

FromEmailAddressを上記で登録したものに置き換える。送信元に捨てアドを設定すると失敗するので注意

```json
{
  "FromEmailAddress": "hoge@gmail.com",
  "Destination": {
    "ToAddresses": [
      "{% $userEmail %}"
    ]
  },
  "Content": {
    "Simple": {
      "Subject": {
        "Data": "注文完了のお知らせ"
      },
      "Body": {
        "Text": {
          "Data": "{% $userName & ' 様' & '\n\n' & '下記商品の注文が完了しました。' & '\n\n' & $itemName & ' × ' & $quantity & ' ' & '合計 ' & $quantity * $itemPrice & '円' %}"
        }
      }
    }
  }
}
```

### IAMポリシーのアタッチ

「設定」タブ → 「IAM で表示」でIAMに移動する

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

## 決済API作成（モック版）

外部決済サービスのAPIを呼び出すイメージ

### 決済処理に見立てたLambda（Lambda）

- 関数名：`sfn-mock-payment`
- ランタイム：`nodejs24.x`

```js
export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const body = event.body ? JSON.parse(event.body) : event;
  
  const cardNumber = body.cardNumber;

  if (token === "1234-1234-1234-1234") {
      return {
        success: true,
        message: "payment successful"
      };
  } else {
      return {
        success: false,
        message: "invalid card"
      };
  }
};
```

### 決済API作成（モック版）

#### APIを作成（APIGW）

- APIタイプを選択：`HTTP API`
- API 名：`sfn-mock-payment-api`
- ルート設定：`未設定`
- ステージ設定：`$default`

#### ルートの作成（APIGW）

- メソッド：`POST`
- パス：`/payments`

#### 統合をアタッチする（APIGW）

上記で作成したLambda関数を選択

### ステートの置き換え（Step Functions）

- Pass → Call HTTPS APIs
- 状態名：`決済`

#### APIエンドポイント

例

```
https://abcd.execute-api.ap-northeast-1.amazonaws.com/payments
```

#### メソッド

```
POST
```

#### 接続とは？

外部APIを叩くための専用窓口。APIキーなどの秘密情報をAWS側が安全に管理してリクエスト時に自動で差し込んでくれる仕組み

#### 接続（作業）

「接続を表示」でAmazon EventBridgeに移動して「接続を作成」

- 接続名：`sfn-api-call`
- APIタイプ：`パブリック`
- 認証を設定：`カスタム設定`
- 認証タイプ：`API キー`（※）
  - APIキー名：`x-dummy-api-key`
  - 値：`dummy`

（※）今回は認証不要だが何かしら設定しないと「作成」出来ないため設定

- 作成した「接続」を選択

#### リクエスト本文

```json
{
  "cardNumber": "{% $cardNumber %}",
  "amount": "{% $itemPrice * $quantity %}"
}
```

#### 引数（引数と出力）

「設定」の内容で自動入力される

#### 出力（引数と出力）

```
{
  "success": "{% $states.result.ResponseBody.success %}"
}
```

## SFn実行API作成

### IAMロール作成

APIGW → StepFunctionsを許可するもの

#### IAMポリシー

- アクセス許可を指定

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": "states:StartSyncExecution",
            "Resource": "*"
        }
    ]
}
```

- ポリシー名：`sfn-order-system-api-policy`

#### IAMロール

- カスタム信頼ポリシー

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Statement1",
            "Effect": "Allow",
            "Principal": {
                "Service": "apigateway.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

- 許可ポリシー：`上記作成したポリシーを選択`
- ロール名：`sfn-order-system-api-role`

#### APIを作成（APIGW）

- APIタイプを選択：`HTTP API`
- API 名：`sfn-order-system-api`
- ルート設定：`未設定`
- ステージ設定：`$default`

#### ルートの作成（APIGW）

- POST
  - メソッド：`POST`
  - パス：`/orders`
- OPTIONS
  - メソッド：`OPTIONS`
  - パス：`/orders`

#### CORSの設定（APIGW）

- Access-Control-Allow-Origin
  - `*`
- Access-Control-Allow-Methods
  - `*`
- Access-Control-Allow-Headers
  - `content-type`

#### 統合をアタッチする（APIGW）

- 統合タイプ：`AWS Step Functions`
- 統合アクション：`StartSyncExecution`
- ステートマシン ARN：

例

```
arn:aws:states:ap-northeast-1:1234567890:stateMachine:sfn-order-system
```

- 呼び出しロール：`上記作成したIAMロールのARNを指定`
- Advanced settings - input - オプション：`$request.body`
- Advanced settings - Region - オプション：`ap-northeast-1`

## フロントとの連携

### コードのDL

「Code」を「Donwload ZIP」

### ライブラリのインストール

```
npm install
```

### APIのURLを設定

- src/App.jsx

```
const API_URL = "";
```

### アプリケーションを起動

```
npm run dev
```

### Next !!!

- 商品を複数にする
- DynamoDB・SES操作のエラーをキャッチする
- etc