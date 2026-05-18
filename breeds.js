// 全犬種データ（日本語名・英語名・グループ）
const DOG_BREEDS = [
  // 雑種・不明
  { ja: '雑種', en: 'Mixed Breed', group: '雑種・不明' },
  { ja: '不明', en: 'Unknown', group: '雑種・不明' },

  // 日本犬
  { ja: '柴犬', en: 'Shiba Inu', group: '日本犬' },
  { ja: '秋田犬', en: 'Akita', group: '日本犬' },
  { ja: '北海道犬', en: 'Hokkaido', group: '日本犬' },
  { ja: '甲斐犬', en: 'Kai Ken', group: '日本犬' },
  { ja: '紀州犬', en: 'Kishu Ken', group: '日本犬' },
  { ja: '四国犬', en: 'Shikoku', group: '日本犬' },
  { ja: '土佐犬', en: 'Tosa Inu', group: '日本犬' },
  { ja: '日本スピッツ', en: 'Japanese Spitz', group: '日本犬' },
  { ja: '日本テリア', en: 'Japanese Terrier', group: '日本犬' },

  // 牧羊犬・牧畜犬
  { ja: 'ジャーマン・シェパード', en: 'German Shepherd', group: '牧羊犬・牧畜犬' },
  { ja: 'ボーダーコリー', en: 'Border Collie', group: '牧羊犬・牧畜犬' },
  { ja: 'オーストラリアン・シェパード', en: 'Australian Shepherd', group: '牧羊犬・牧畜犬' },
  { ja: 'シェットランド・シープドッグ（シェルティ）', en: 'Shetland Sheepdog', group: '牧羊犬・牧畜犬' },
  { ja: 'ベルジアン・マリノワ', en: 'Belgian Malinois', group: '牧羊犬・牧畜犬' },
  { ja: 'ベルジアン・タービュレン', en: 'Belgian Tervuren', group: '牧羊犬・牧畜犬' },
  { ja: 'ベルジアン・シェパード', en: 'Belgian Shepherd', group: '牧羊犬・牧畜犬' },
  { ja: 'コリー（ラフ）', en: 'Rough Collie', group: '牧羊犬・牧畜犬' },
  { ja: 'コリー（スムース）', en: 'Smooth Collie', group: '牧羊犬・牧畜犬' },
  { ja: 'オールド・イングリッシュ・シープドッグ', en: 'Old English Sheepdog', group: '牧羊犬・牧畜犬' },
  { ja: 'プーリー', en: 'Puli', group: '牧羊犬・牧畜犬' },
  { ja: 'コモンドール', en: 'Komondor', group: '牧羊犬・牧畜犬' },
  { ja: 'サモエド', en: 'Samoyed', group: '牧羊犬・牧畜犬' },
  { ja: 'ウェルシュ・コーギー・ペンブローク', en: 'Welsh Corgi Pembroke', group: '牧羊犬・牧畜犬' },
  { ja: 'ウェルシュ・コーギー・カーディガン', en: 'Welsh Corgi Cardigan', group: '牧羊犬・牧畜犬' },
  { ja: 'オーストラリアン・キャトル・ドッグ', en: 'Australian Cattle Dog', group: '牧羊犬・牧畜犬' },
  { ja: 'オーストラリアン・ケルピー', en: 'Australian Kelpie', group: '牧羊犬・牧畜犬' },

  // 使役犬
  { ja: 'ロットワイラー', en: 'Rottweiler', group: '使役犬' },
  { ja: 'ドーベルマン', en: 'Doberman Pinscher', group: '使役犬' },
  { ja: 'グレート・デーン', en: 'Great Dane', group: '使役犬' },
  { ja: 'セントバーナード', en: 'Saint Bernard', group: '使役犬' },
  { ja: 'バーニーズ・マウンテン・ドッグ', en: 'Bernese Mountain Dog', group: '使役犬' },
  { ja: 'グレート・ピレニーズ', en: 'Great Pyrenees', group: '使役犬' },
  { ja: 'ニューファンドランド', en: 'Newfoundland', group: '使役犬' },
  { ja: 'ボクサー', en: 'Boxer', group: '使役犬' },
  { ja: 'マスティフ', en: 'Mastiff', group: '使役犬' },
  { ja: 'ブルマスティフ', en: 'Bullmastiff', group: '使役犬' },
  { ja: 'ナポリタン・マスティフ', en: 'Neapolitan Mastiff', group: '使役犬' },
  { ja: 'チベタン・マスティフ', en: 'Tibetan Mastiff', group: '使役犬' },
  { ja: 'アラスカン・マラミュート', en: 'Alaskan Malamute', group: '使役犬' },
  { ja: 'シベリアン・ハスキー', en: 'Siberian Husky', group: '使役犬' },
  { ja: 'グレート・スイス・マウンテン・ドッグ', en: 'Greater Swiss Mountain Dog', group: '使役犬' },
  { ja: 'ドーベルマン・ピンシャー', en: 'Dobermann', group: '使役犬' },
  { ja: 'ジャイアント・シュナウザー', en: 'Giant Schnauzer', group: '使役犬' },
  { ja: 'スタンダード・シュナウザー', en: 'Standard Schnauzer', group: '使役犬' },
  { ja: 'ホワイト・スイス・シェパード', en: 'White Swiss Shepherd', group: '使役犬' },

  // テリア
  { ja: 'ヨークシャー・テリア', en: 'Yorkshire Terrier', group: 'テリア' },
  { ja: 'ウェスト・ハイランド・ホワイト・テリア', en: 'West Highland White Terrier', group: 'テリア' },
  { ja: 'スコティッシュ・テリア', en: 'Scottish Terrier', group: 'テリア' },
  { ja: 'ケアーン・テリア', en: 'Cairn Terrier', group: 'テリア' },
  { ja: 'ワイヤー・フォックス・テリア', en: 'Wire Fox Terrier', group: 'テリア' },
  { ja: 'スムース・フォックス・テリア', en: 'Smooth Fox Terrier', group: 'テリア' },
  { ja: 'ジャック・ラッセル・テリア', en: 'Jack Russell Terrier', group: 'テリア' },
  { ja: 'パーソン・ラッセル・テリア', en: 'Parson Russell Terrier', group: 'テリア' },
  { ja: 'ミニチュア・シュナウザー', en: 'Miniature Schnauzer', group: 'テリア' },
  { ja: 'ブル・テリア', en: 'Bull Terrier', group: 'テリア' },
  { ja: 'スタッフォードシャー・ブル・テリア', en: 'Staffordshire Bull Terrier', group: 'テリア' },
  { ja: 'アメリカン・スタッフォードシャー・テリア', en: 'American Staffordshire Terrier', group: 'テリア' },
  { ja: 'ベドリントン・テリア', en: 'Bedlington Terrier', group: 'テリア' },
  { ja: 'ダンディ・ディンモント・テリア', en: 'Dandie Dinmont Terrier', group: 'テリア' },
  { ja: 'アイリッシュ・テリア', en: 'Irish Terrier', group: 'テリア' },
  { ja: 'レイクランド・テリア', en: 'Lakeland Terrier', group: 'テリア' },
  { ja: 'マンチェスター・テリア', en: 'Manchester Terrier', group: 'テリア' },
  { ja: 'スカイ・テリア', en: 'Skye Terrier', group: 'テリア' },
  { ja: 'ソフト・コーテッド・ウィートン・テリア', en: 'Soft Coated Wheaten Terrier', group: 'テリア' },
  { ja: 'ボーダー・テリア', en: 'Border Terrier', group: 'テリア' },
  { ja: 'ノーリッジ・テリア', en: 'Norwich Terrier', group: 'テリア' },
  { ja: 'ノーフォーク・テリア', en: 'Norfolk Terrier', group: 'テリア' },

  // 愛玩犬（トイ）
  { ja: 'チワワ', en: 'Chihuahua', group: '愛玩犬' },
  { ja: 'トイ・プードル', en: 'Toy Poodle', group: '愛玩犬' },
  { ja: 'ポメラニアン', en: 'Pomeranian', group: '愛玩犬' },
  { ja: 'マルチーズ', en: 'Maltese', group: '愛玩犬' },
  { ja: 'シー・ズー', en: 'Shih Tzu', group: '愛玩犬' },
  { ja: 'パピヨン', en: 'Papillon', group: '愛玩犬' },
  { ja: 'パグ', en: 'Pug', group: '愛玩犬' },
  { ja: 'キャバリア・キング・チャールズ・スパニエル', en: 'Cavalier King Charles Spaniel', group: '愛玩犬' },
  { ja: 'ペキニーズ', en: 'Pekingese', group: '愛玩犬' },
  { ja: 'ジャパニーズ・チン', en: 'Japanese Chin', group: '愛玩犬' },
  { ja: 'イタリアン・グレーハウンド', en: 'Italian Greyhound', group: '愛玩犬' },
  { ja: 'ミニチュア・ピンシャー', en: 'Miniature Pinscher', group: '愛玩犬' },
  { ja: 'アフェン・ピンシャー', en: 'Affenpinscher', group: '愛玩犬' },
  { ja: 'ブリュッセル・グリフォン', en: 'Brussels Griffon', group: '愛玩犬' },
  { ja: 'ハバネーゼ', en: 'Havanese', group: '愛玩犬' },
  { ja: 'ボロニーズ', en: 'Bolognese', group: '愛玩犬' },
  { ja: 'コトン・ド・テュレアール', en: 'Coton de Tulear', group: '愛玩犬' },
  { ja: 'ビション・フリーゼ', en: 'Bichon Frise', group: '愛玩犬' },
  { ja: 'トイ・マンチェスター・テリア', en: 'Toy Manchester Terrier', group: '愛玩犬' },

  // 猟犬（スポーティング）
  { ja: 'ラブラドール・レトリーバー', en: 'Labrador Retriever', group: '猟犬・スポーティング' },
  { ja: 'ゴールデン・レトリーバー', en: 'Golden Retriever', group: '猟犬・スポーティング' },
  { ja: 'コッカー・スパニエル（アメリカン）', en: 'American Cocker Spaniel', group: '猟犬・スポーティング' },
  { ja: 'イングリッシュ・コッカー・スパニエル', en: 'English Cocker Spaniel', group: '猟犬・スポーティング' },
  { ja: 'イングリッシュ・スプリンガー・スパニエル', en: 'English Springer Spaniel', group: '猟犬・スポーティング' },
  { ja: 'フラット・コーテッド・レトリーバー', en: 'Flat-Coated Retriever', group: '猟犬・スポーティング' },
  { ja: 'カーリー・コーテッド・レトリーバー', en: 'Curly-Coated Retriever', group: '猟犬・スポーティング' },
  { ja: 'チェサピーク・ベイ・レトリーバー', en: 'Chesapeake Bay Retriever', group: '猟犬・スポーティング' },
  { ja: 'アイリッシュ・セター', en: 'Irish Setter', group: '猟犬・スポーティング' },
  { ja: 'イングリッシュ・セター', en: 'English Setter', group: '猟犬・スポーティング' },
  { ja: 'ゴードン・セター', en: 'Gordon Setter', group: '猟犬・スポーティング' },
  { ja: 'ポインター', en: 'Pointer', group: '猟犬・スポーティング' },
  { ja: 'ジャーマン・ショートヘアード・ポインター', en: 'German Shorthaired Pointer', group: '猟犬・スポーティング' },
  { ja: 'ジャーマン・ワイヤーヘアード・ポインター', en: 'German Wirehaired Pointer', group: '猟犬・スポーティング' },
  { ja: 'ブリタニー', en: 'Brittany', group: '猟犬・スポーティング' },
  { ja: 'ヴィズラ', en: 'Vizsla', group: '猟犬・スポーティング' },
  { ja: 'ワイマラナー', en: 'Weimaraner', group: '猟犬・スポーティング' },
  { ja: 'アイリッシュ・ウォーター・スパニエル', en: 'Irish Water Spaniel', group: '猟犬・スポーティング' },
  { ja: 'ウェルシュ・スプリンガー・スパニエル', en: 'Welsh Springer Spaniel', group: '猟犬・スポーティング' },
  { ja: 'スパニッシュ・ウォーター・ドッグ', en: 'Spanish Water Dog', group: '猟犬・スポーティング' },

  // 嗅覚猟犬（ハウンド）
  { ja: 'ビーグル', en: 'Beagle', group: 'ハウンド' },
  { ja: 'バセット・ハウンド', en: 'Basset Hound', group: 'ハウンド' },
  { ja: 'ダックスフンド（スタンダード）', en: 'Standard Dachshund', group: 'ハウンド' },
  { ja: 'ダックスフンド（ミニチュア）', en: 'Miniature Dachshund', group: 'ハウンド' },
  { ja: 'ダックスフンド（カニンヘン）', en: 'Kaninchen Dachshund', group: 'ハウンド' },
  { ja: 'ブラッドハウンド', en: 'Bloodhound', group: 'ハウンド' },
  { ja: 'ロードウェルシュ・コーギー', en: 'Rhodesian Ridgeback', group: 'ハウンド' },
  { ja: 'ローデシアン・リッジバック', en: 'Rhodesian Ridgeback', group: 'ハウンド' },
  { ja: 'アフガン・ハウンド', en: 'Afghan Hound', group: 'ハウンド' },
  { ja: 'サルーキ', en: 'Saluki', group: 'ハウンド' },
  { ja: 'グレーハウンド', en: 'Greyhound', group: 'ハウンド' },
  { ja: 'ウィペット', en: 'Whippet', group: 'ハウンド' },
  { ja: 'アイリッシュ・ウルフハウンド', en: 'Irish Wolfhound', group: 'ハウンド' },
  { ja: 'スコティッシュ・ディアハウンド', en: 'Scottish Deerhound', group: 'ハウンド' },
  { ja: 'ノルウェジアン・エルクハウンド', en: 'Norwegian Elkhound', group: 'ハウンド' },
  { ja: 'バセンジー', en: 'Basenji', group: 'ハウンド' },
  { ja: 'ハリア', en: 'Harrier', group: 'ハウンド' },
  { ja: 'オッターハウンド', en: 'Otterhound', group: 'ハウンド' },
  { ja: 'プロットハウンド', en: 'Plott Hound', group: 'ハウンド' },
  { ja: 'スロウギ', en: 'Sloughi', group: 'ハウンド' },
  { ja: 'アズワク', en: 'Azawakh', group: 'ハウンド' },
  { ja: 'ファラオ・ハウンド', en: 'Pharaoh Hound', group: 'ハウンド' },
  { ja: 'シシオン・イビセンク', en: 'Ibizan Hound', group: 'ハウンド' },
  { ja: 'ポルトガリーゼ・ポデンゴ', en: 'Portuguese Podengo', group: 'ハウンド' },

  // ノン・スポーティング
  { ja: 'スタンダード・プードル', en: 'Standard Poodle', group: 'ノン・スポーティング' },
  { ja: 'ミディアム・プードル', en: 'Medium Poodle', group: 'ノン・スポーティング' },
  { ja: 'ミニチュア・プードル', en: 'Miniature Poodle', group: 'ノン・スポーティング' },
  { ja: 'フレンチ・ブルドッグ', en: 'French Bulldog', group: 'ノン・スポーティング' },
  { ja: 'イングリッシュ・ブルドッグ', en: 'English Bulldog', group: 'ノン・スポーティング' },
  { ja: 'チャイニーズ・シャー・ペイ', en: 'Chinese Shar-Pei', group: 'ノン・スポーティング' },
  { ja: 'チャウ・チャウ', en: 'Chow Chow', group: 'ノン・スポーティング' },
  { ja: 'ダルメシアン', en: 'Dalmatian', group: 'ノン・スポーティング' },
  { ja: 'ラサ・アプソ', en: 'Lhasa Apso', group: 'ノン・スポーティング' },
  { ja: 'シュンコ', en: 'Chinese Crested', group: 'ノン・スポーティング' },
  { ja: 'チャイニーズ・クレステッド', en: 'Chinese Crested', group: 'ノン・スポーティング' },
  { ja: 'キースホンド', en: 'Keeshond', group: 'ノン・スポーティング' },
  { ja: 'アメリカン・エスキモー・ドッグ', en: 'American Eskimo Dog', group: 'ノン・スポーティング' },
  { ja: 'フィン・スピッツ', en: 'Finnish Spitz', group: 'ノン・スポーティング' },
  { ja: 'ノルウェジアン・ルンデフンド', en: 'Norwegian Lundehund', group: 'ノン・スポーティング' },
  { ja: 'ティベタン・スパニエル', en: 'Tibetan Spaniel', group: 'ノン・スポーティング' },
  { ja: 'ティベタン・テリア', en: 'Tibetan Terrier', group: 'ノン・スポーティング' },
  { ja: 'シュナウザー（スタンダード）', en: 'Standard Schnauzer', group: 'ノン・スポーティング' },
  { ja: 'ローチェン', en: 'Lowchen', group: 'ノン・スポーティング' },

  // 特定・その他
  { ja: 'ゴールデンドゥードル', en: 'Goldendoodle', group: 'デザイナー犬' },
  { ja: 'ラブラドゥードル', en: 'Labradoodle', group: 'デザイナー犬' },
  { ja: 'マルチプー', en: 'Maltipoo', group: 'デザイナー犬' },
  { ja: 'シュヌードル', en: 'Schnoodle', group: 'デザイナー犬' },
  { ja: 'コッカプー', en: 'Cockapoo', group: 'デザイナー犬' },
  { ja: 'ポメスキー', en: 'Pomsky', group: 'デザイナー犬' },
  { ja: 'バーガマスコ', en: 'Bergamasco', group: 'その他' },
  { ja: 'シロ', en: 'Thai Ridgeback', group: 'その他' },
  { ja: 'タイ・リッジバック', en: 'Thai Ridgeback', group: 'その他' },
  { ja: 'カナン・ドッグ', en: 'Canaan Dog', group: 'その他' },
  { ja: 'ペルーヴィアン・インカ・オーキッド', en: 'Peruvian Inca Orchid', group: 'その他' },
  { ja: 'スウェディッシュ・ヴァルフンド', en: 'Swedish Vallhund', group: 'その他' },
  { ja: 'フィンランド・スピッツ', en: 'Finnish Spitz', group: 'その他' },
  { ja: 'エントルブーハー・マウンテン・ドッグ', en: 'Entlebucher Mountain Dog', group: 'その他' },
  { ja: 'アッペンツェラー', en: 'Appenzeller Sennenhund', group: 'その他' },
];

// 全猫種データ（日本語名・英語名・グループ）
const CAT_BREEDS = [
  // 雑種・不明
  { ja: '雑種', en: 'Mixed Breed', group: '雑種・不明' },
  { ja: '不明', en: 'Unknown', group: '雑種・不明' },
  { ja: '日本猫', en: 'Japanese Cat', group: '雑種・不明' },

  // 短毛種
  { ja: 'アメリカン・ショートヘア', en: 'American Shorthair', group: '短毛種' },
  { ja: 'アビシニアン', en: 'Abyssinian', group: '短毛種' },
  { ja: 'エキゾチック・ショートヘア', en: 'Exotic Shorthair', group: '短毛種' },
  { ja: 'オシキャット', en: 'Ocicat', group: '短毛種' },
  { ja: 'オリエンタル・ショートヘア', en: 'Oriental Shorthair', group: '短毛種' },
  { ja: 'エジプシャン・マウ', en: 'Egyptian Mau', group: '短毛種' },
  { ja: 'コラット', en: 'Korat', group: '短毛種' },
  { ja: 'シャム', en: 'Siamese', group: '短毛種' },
  { ja: 'シャルトリュー', en: 'Chartreux', group: '短毛種' },
  { ja: 'シンガプーラ', en: 'Singapura', group: '短毛種' },
  { ja: 'スコティッシュ・ストレート（短毛）', en: 'Scottish Straight', group: '短毛種' },
  { ja: 'スノーシュー', en: 'Snowshoe', group: '短毛種' },
  { ja: 'ソコケ', en: 'Sokoke', group: '短毛種' },
  { ja: 'タイ', en: 'Thai', group: '短毛種' },
  { ja: 'トイガー', en: 'Toyger', group: '短毛種' },
  { ja: 'トンキニーズ', en: 'Tonkinese', group: '短毛種' },
  { ja: 'ハバナ・ブラウン', en: 'Havana Brown', group: '短毛種' },
  { ja: 'バーミーズ', en: 'Burmese', group: '短毛種' },
  { ja: 'ベンガル', en: 'Bengal', group: '短毛種' },
  { ja: 'ボンベイ', en: 'Bombay', group: '短毛種' },
  { ja: 'ブリティッシュ・ショートヘア', en: 'British Shorthair', group: '短毛種' },
  { ja: 'ロシアンブルー', en: 'Russian Blue', group: '短毛種' },

  // 長毛種
  { ja: 'アメリカン・ボブテイル', en: 'American Bobtail', group: '長毛種' },
  { ja: 'オリエンタル・ロングヘア', en: 'Oriental Longhair', group: '長毛種' },
  { ja: 'サイベリアン', en: 'Siberian', group: '長毛種' },
  { ja: 'サファリ', en: 'Safari', group: '長毛種' },
  { ja: 'ジャパニーズ・ボブテイル', en: 'Japanese Bobtail', group: '長毛種' },
  { ja: 'ソマリ', en: 'Somali', group: '長毛種' },
  { ja: 'ターキッシュ・アンゴラ', en: 'Turkish Angora', group: '長毛種' },
  { ja: 'ターキッシュ・バン', en: 'Turkish Van', group: '長毛種' },
  { ja: 'ノルウェージャン・フォレスト・キャット', en: 'Norwegian Forest Cat', group: '長毛種' },
  { ja: 'バーマン', en: 'Birman', group: '長毛種' },
  { ja: 'バリニーズ', en: 'Balinese', group: '長毛種' },
  { ja: 'ヒマラヤン', en: 'Himalayan', group: '長毛種' },
  { ja: 'ブリティッシュ・ロングヘア', en: 'British Longhair', group: '長毛種' },
  { ja: 'ペルシャ', en: 'Persian', group: '長毛種' },
  { ja: 'メイン・クーン', en: 'Maine Coon', group: '長毛種' },
  { ja: 'ラガマフィン', en: 'Ragamuffin', group: '長毛種' },
  { ja: 'ラグドール', en: 'Ragdoll', group: '長毛種' },

  // 特徴種
  { ja: 'アメリカン・カール', en: 'American Curl', group: '耳や尾の特徴種' },
  { ja: 'キムリック', en: 'Cymric', group: '耳や尾の特徴種' },
  { ja: 'スコティッシュ・フォールド', en: 'Scottish Fold', group: '耳や尾の特徴種' },
  { ja: 'マンクス', en: 'Manx', group: '耳や尾の特徴種' },

  // 短足種
  { ja: 'マンチカン', en: 'Munchkin', group: '短足種' },
  { ja: 'ミヌエット', en: 'Minuet', group: '短足種' },
  { ja: 'キンカロー', en: 'Kinkalow', group: '短足種' },
  { ja: 'スクーカム', en: 'Skookum', group: '短足種' },
  { ja: 'ラムキン', en: 'Lambkin', group: '短足種' },

  // 特殊種
  { ja: 'コーニッシュ・レックス', en: 'Cornish Rex', group: '巻き毛・無毛・特殊種' },
  { ja: 'サバンナ・キャット', en: 'Savannah Cat', group: '巻き毛・無毛・特殊種' },
  { ja: 'セルカーク・レックス', en: 'Selkirk Rex', group: '巻き毛・無毛・特殊種' },
  { ja: 'スフィンクス', en: 'Sphynx', group: '巻き毛・無毛・特殊種' },
  { ja: 'デボン・レックス', en: 'Devon Rex', group: '巻き毛・無毛・特殊種' },
  { ja: 'ドンスコイ', en: 'Donskoy', group: '巻き毛・無毛・特殊種' },
  { ja: 'ピーターボールド', en: 'Peterbald', group: '巻き毛・無毛・特殊種' },
  { ja: 'ラパーマ', en: 'LaPerm', group: '巻き毛・無毛・特殊種' },
  { ja: 'ライコイ', en: 'Lykoi', group: '巻き毛・無毛・特殊種' },
];

// 重複除去＆ソート
const DOG_BREEDS_UNIQUE = (() => {
  const seen = new Set();
  return DOG_BREEDS.filter(b => {
    if (seen.has(b.ja)) return false;
    seen.add(b.ja);
    return true;
  });
})();

const CAT_BREEDS_UNIQUE = (() => {
  const seen = new Set();
  return CAT_BREEDS.filter(b => {
    if (seen.has(b.ja)) return false;
    seen.add(b.ja);
    return true;
  });
})();

const BREEDS_UNIQUE = DOG_BREEDS_UNIQUE;

