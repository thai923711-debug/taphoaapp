const products = {
  "Gia vị & thực phẩm khô": [
    "Đường to", "Đường nhuyễn", "Đường phèn", "Nước mắm đệ nhị 900ml",
    "Nước tương nhị ca 500ml", "Nước tương nhất ca 500ml", "Bột ngọt Ajinomoto 400gram",
    "Bột ngọt Ajinomoto 450gram", "Bột ngọt Ajinomoto 1KG", "Hạt nêm Ajingon 170gram", "Hạt nêm Ajingon 400g",
    "Tương ớt chinsu 500ml", "Tương ớt chinsu 250ml", "Chao đại", "Chao trung",
    "Chao nhí", "Cá mồi 3 cô gái", "Trà Ngọc Trang Dứa", "Trà Ngọc Trang BLao", "Trà Thiên Hương", "Trà lài Kim Lộc",
    "Nước mắm nam ngư 500ml", "Nước mắm nam ngư 750ml", "Nước mắm Hưng Thịnh 40 độ", "Trà dứa Kim Lộc"
  ],
  "Mì, cháo & thực phẩm ăn liền": [
    "Mì cung đình ly", "Mì cung đình KooL Spaghetti", "Mì hảo hảo bịch",
    "Mì hảo hảo ly", "Mì Omachi trộn bịch", "Mì Modern Lẩu thái tôm Ly",
    "Mì Omachi Tôm Chua Cay Bịch", "Mì Omachi Sườn Hầm Ngũ Quả", "Mì Omachi Xốt Bò Hầm",
    "Mì 3 miền chua cay bịch", "Mì 3 miền đặc biệt", "Mì gấu đỏ chua cay bịch", "Mì gấu đỏ thịt bầm bịch",
    "Mì gấu đỏ chay rau nấm", "Mì gấu đỏ sợi phở bịch", "Mì kokomi đại bịch","Miến Phú Hương",
    "Cháo gấu đỏ bịch", "Cháo yến bịch", "Hủ tiếu nhịp sống Sườn Heo"
  ],
  "Sữa & đồ uống": [
    "Sữa Vinamilk không đường bịch", "Sữa Vinamilk có đường bịch", "Sữa đậu nành Fami bịch",
    "Sữa Milo hộp 180ml", "Sữa Milo hộp 110ml", "Sữa con bò 100% 110ml",
    "Sữa con bò 100% 180ml", "Sữa Su Su", "Cafe Sài Gòn", "Cafe Trần Quang",
    "Cafe Vinacafe", "Cafe Phố", "Yến sào có đường", "Yến sào không đường", "Sữa ngôi sao giấy lớn", "Sữa ngôi sao giấy nhỏ"
  ],
  "Nước ngọt & bia": [
    "Nước ngọt Coca 500ml Lon", "Nước ngọt Coca 1Lít5", "Nước ngọt Pepsi 500ml",
    "Nước ngọt Pepsi 1Lít5", "Nước ngọt Sting Thái lon", "Nước ngọt Sting chai","Nước ngọt 247",
    "Nước ngọt Sting chai vàng", "Nước ngọt Trà xanh", "Nước ngọt Boncha tắc", "Bí Đao",
    "Nước ngọt Boncha việt quốc", "Nước suối Aquafina 500ml", "Nước suối Aquafina 1Lít5",
    "Nước suối Lavie 1Lít5", "Nước suối Lavie 350ml", "Nước suối Lavie 500ml", "Nước suối Lavie 5 Lít",
    "Nước suối Number1", "Nước ngọt Number1 vàng", "Bia Sài Gòn xanh", "Bia Tiger", "Bia Larue Bạc",
    "Bia Tiger bạc cao", "Bia Larue", "Bia Heineken xanh lá", "Bia Heineken bạc lùn",
    "Bia Heineken bạc cao", "Ôlong", "Bò cụng", "Trà mẳng cụt", "sữa đậu nành lon", "Nước ngọt Sá Xị",
    "Sữa đậu nành fami hộp", "Nha Đam", "Pepsi lon", "C2 Chanh", "C2 Đào", "C2 Dưa Lưới", "Sting nho lon"
  ],
  "Hóa phẩm & vệ sinh cá nhân": [
    "Nước rửa chén Mỹ Hảo 400g", "Nước rửa chén Mỹ Hảo 750g",
    "Nước rửa chén Sunlight 400g", "Nước rửa chén Sunlight 750g",
    "Nước rửa chén Sunlight 3kg6", "Nước rửa chén Mỹ Hảo 3kg6",
    "Lau sàn Sunlight hồng", "Lau sàn Sunlight xanh", "Lau sàn Sunlight 3kg6",
    "Xịt muỗi Kingstar", "Xịt muỗi Jumbo Vape", "Xịt muỗi Jumbo không mùi",
    "Nhang muỗi Jumbo ít khói", "Nhang muỗi Jumbo", "Nhang muỗi Thái",
    "Xà bông OMO bịch 400g", "Xà bông OMO bịch 800g", "Xà bông Aba bịch 400g", "Xà bông Aba bịch 800g",
    "Xà bông OMO bịch 3kg", "Xà bông bịch Aba 3kg",
    "Băng vệ sinh Diana mỏng cánh", "Băng vệ sinh Kotex mỏng cánh", "Băng Vệ Sinh Diana Sensi",
    "Băng vệ sinh Kotex hằng ngày", "Băng vệ sinh Kotex ban đêm", "Kem đánh răng PS",
    "Giấy cuộn Vinaroll", "Giấy an an", "Xịt muỗi Số 9 Đỏ",
    "Dầu xã Thái", "Dầu xã Comfort hương ban mai",
    "Dầu gội Rejoice", "Dầu gội Clear", "Dầu gội sunsilk đen", "Dầu gội XMEN",
    "Nước tẩy Con Vịt Duck", "Nước tẩy Vim"
  ],
  "Khác": [
    "Bộ bài tiến lên", "Ống quẹt khò", "Ống quẹt bấm", "Ống quẹt đá",
    "Thuốc lá Jet", "Thuốc lá Jet Việt Trắng", "Thuốc lá Jet Việt Xanh",
    "Thuốc lá bastos xanh", "Thuốc lá bastos tím", "Thuốc lá sài gòn bạc",
    "Thuốc lá sài gòn vàng", "Thuốc lá mèo mi", "Thuốc lá mèo đỏ",
    "Thuốc lá khánh hội", "Thuốc lá hòa bình hộp", "Thuốc lá 3 số 555",
    "Dầu ăn An Long 1 Lít", "Dầu ăn An Long 2 Lít", "Dầu ăn An Long 5 Lít",
    "Dầu ăn Tường An 1 Lít", "Dầu ăn Tường An 2 Lít", "Dầu ăn Tường An 5 Lít",
    "Dầu ăn Happi Koki 400g",
    "Bún khô", "Bánh tráng Tân Nhiên"
  ]
};
