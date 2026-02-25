import { useState } from "react";
import "./App.css";

const API_URL = "";

function App() {
  const [items, setItems] = useState([
    { id: "abc", name: "ロゴTシャツ", price: 1000, quantity: 1 },
    // { id: 2, name: 'キャラTシャツ', price: 1500, quantity: 1 },
  ]);

  const cardOptions = [
    { name: "A", last4digits: "1234", token: "abcd" },
    { name: "B", last4digits: "5678", token: "efgh" },
  ];
  const [selectedCard, setSelectedCard] = useState(cardOptions[0]);

  // ユーザー情報の状態管理
  const [userName, setUserName] = useState("代々木二郎");
  const [userEmail, setUserEmail] = useState("hoge@fuga.com");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  // 数量が変更された時の処理
  const handleQuantityChange = (id, newQuantity) => {
    const updatedItems = items.map((item) => {
      if (item.id === id) {
        // 0以下の数値にならないように調整
        const val = parseInt(newQuantity) || 0;
        return { ...item, quantity: val < 0 ? 0 : val };
      }
      return item;
    });
    setItems(updatedItems);
  };

  const handleCardChange = (e) => {
    const cardName = e.target.value;
    const card = cardOptions.find((c) => c.name === cardName);
    setSelectedCard(card);
  };

  const handleOrderSubmit = async () => {
    // 二重送信防止
    setIsSubmitting(true);

    const orderData = {
      cardToken: selectedCard.token,
      amount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      userName: userName,
      userEmail: userEmail,
      itemId: items[0].id,
      items: items,
    };

    try {
      const response = await fetch(
        `${API_URL}/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderData),
        },
      );

      const data = await response.json();
      console.log("AWS Response:", data);

      if (data.status === "SUCCEEDED") {
        setOrderResult({ success: true, email: userEmail });
      } else if (data.status === "FAILED") {
        // Failステートに遷移した場合
        setOrderResult({ success: false, message: data.error });
      }
    } catch (error) {
      console.error("Error submitting order:", error);
      setOrderResult({ success: false, message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 合計金額の計算
  const totalAmount = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <div className="container">
      <h2>ご注文手続き</h2>

      <table className="order-table">
        <thead>
          <tr>
            <th>商品名</th>
            <th>数量</th>
            <th>小計</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>
                <input
                  type="number"
                  className="quantity-input"
                  value={item.quantity}
                  onChange={(e) =>
                    handleQuantityChange(item.id, e.target.value)
                  }
                />
              </td>
              <td className="item-total">
                {(item.price * item.quantity).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="order-total">合計： {totalAmount}円</div>

      <div className="user-info">
        <div className="input-group">
          <label>名前：</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>メールアドレス：</label>
          <input
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>カード：</label>
          <select value={selectedCard.name} onChange={handleCardChange}>
            {cardOptions.map((card) => (
              <option key={card.name} value={card.name}>
                カード{card.name} (**** {card.last4digits})
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        className="submit-button"
        onClick={handleOrderSubmit}
        disabled={isSubmitting}
        style={{ backgroundColor: isSubmitting ? "#ccc" : "red" }}
      >
        {isSubmitting ? "処理中..." : "注文を確定する"}
      </button>

      {orderResult && orderResult.success && (
        <div className="success-message">
          <h3>ご注文ありがとうございます！</h3>
          <p><strong>{orderResult.email}</strong> 宛てに確認メールを送信しました。</p>
          <p className="note">もし、数分以内に届かない場合は、お手数ですがお問い合わせください。</p>
        </div>
      )}

      {orderResult && !orderResult.success && (
        <div className="error-message">
          エラー: {orderResult.message}
        </div>
      )}

    </div>
  );
}

export default App;
