insert into public.products (slug, name, description, category, price_centavos, retail_price_centavos, is_featured, created_at) values
  ('oxford-button-down-white', 'Oxford Button-Down Shirt', 'Crisp cotton oxford from a premium label''s surplus run. Regular fit, button-down collar.', 'tops', 69000, 189900, true, now() - interval '1 day'),
  ('heavyweight-tee-black', 'Heavyweight Tee', '240gsm cotton tee with a boxy fit. Factory overrun, tags removed.', 'tops', 45000, 129500, true, now() - interval '2 days'),
  ('striped-polo-navy', 'Striped Polo', 'Piqué polo with contrast stripes. Limited sizes from the last run.', 'tops', 59000, 159900, false, now() - interval '3 days'),
  ('crewneck-sweatshirt-grey', 'Crewneck Sweatshirt', 'Brushed fleece crewneck in heather grey.', 'tops', 89000, 249900, false, now() - interval '4 days'),
  ('slim-chino-khaki', 'Slim Chino', 'Stretch cotton chino, slim tapered leg.', 'bottoms', 99000, 279900, true, now() - interval '5 days'),
  ('cargo-shorts-olive', 'Cargo Shorts', 'Ripstop cargo shorts with six pockets.', 'bottoms', 65000, 179900, false, now() - interval '6 days'),
  ('track-pants-black', 'Track Pants', 'Tricot track pants with side stripes and zip cuffs.', 'bottoms', 79000, 219900, false, now() - interval '7 days'),
  ('coach-jacket-black', 'Coach Jacket', 'Water-resistant nylon coach jacket with snap front.', 'outerwear', 149000, 429900, true, now() - interval '8 days'),
  ('quilted-vest-navy', 'Quilted Vest', 'Lightweight quilted vest, great for aircon offices.', 'outerwear', 119000, 349900, false, now() - interval '9 days'),
  ('kids-graphic-tee-yellow', 'Kids Graphic Tee', 'Soft cotton tee for kids with a front print.', 'kids', 29000, 79900, false, now() - interval '10 days'),
  ('canvas-tote-natural', 'Canvas Tote', 'Heavy canvas tote with inner pocket.', 'accessories', 35000, 99000, false, now() - interval '11 days'),
  ('dad-cap-washed-blue', 'Dad Cap', 'Washed cotton cap with adjustable strap.', 'accessories', 39000, 119900, false, now() - interval '12 days');

-- Demo photos (generated in Stitch) bundled in public/demo/products until the owner uploads real ones.
update public.products p set images = v.images
from (values
  ('canvas-tote-natural', array['/demo/products/canvas-tote-natural-1.jpg', '/demo/products/canvas-tote-natural-2.jpg']),
  ('cargo-shorts-olive', array['/demo/products/cargo-shorts-olive-1.jpg']),
  ('coach-jacket-black', array['/demo/products/coach-jacket-black-1.jpg', '/demo/products/coach-jacket-black-2.jpg']),
  ('crewneck-sweatshirt-grey', array['/demo/products/crewneck-sweatshirt-grey-1.jpg']),
  ('dad-cap-washed-blue', array['/demo/products/dad-cap-washed-blue-1.jpg']),
  ('heavyweight-tee-black', array['/demo/products/heavyweight-tee-black-1.jpg']),
  ('kids-graphic-tee-yellow', array['/demo/products/kids-graphic-tee-yellow-1.jpg']),
  ('oxford-button-down-white', array['/demo/products/oxford-button-down-white-1.jpg', '/demo/products/oxford-button-down-white-2.jpg']),
  ('quilted-vest-navy', array['/demo/products/quilted-vest-navy-1.jpg']),
  ('slim-chino-khaki', array['/demo/products/slim-chino-khaki-1.jpg']),
  ('striped-polo-navy', array['/demo/products/striped-polo-navy-1.jpg', '/demo/products/striped-polo-navy-2.jpg']),
  ('track-pants-black', array['/demo/products/track-pants-black-1.jpg'])
) as v(slug, images)
where p.slug = v.slug;

insert into public.product_variants (product_id, size, stock)
select p.id, v.size::public.product_size, v.stock
from (values
  ('oxford-button-down-white', 'S', 2), ('oxford-button-down-white', 'M', 3), ('oxford-button-down-white', 'L', 1), ('oxford-button-down-white', 'XL', 0),
  ('heavyweight-tee-black', 'S', 5), ('heavyweight-tee-black', 'M', 8), ('heavyweight-tee-black', 'L', 6), ('heavyweight-tee-black', 'XL', 2),
  ('striped-polo-navy', 'M', 1), ('striped-polo-navy', 'L', 0), ('striped-polo-navy', 'XL', 2),
  ('crewneck-sweatshirt-grey', 'S', 0), ('crewneck-sweatshirt-grey', 'M', 0), ('crewneck-sweatshirt-grey', 'L', 0),
  ('slim-chino-khaki', 'S', 2), ('slim-chino-khaki', 'M', 4), ('slim-chino-khaki', 'L', 3), ('slim-chino-khaki', 'XL', 1), ('slim-chino-khaki', 'XXL', 1),
  ('cargo-shorts-olive', 'M', 3), ('cargo-shorts-olive', 'L', 2), ('cargo-shorts-olive', 'XL', 0),
  ('track-pants-black', 'XS', 1), ('track-pants-black', 'S', 2), ('track-pants-black', 'M', 2),
  ('coach-jacket-black', 'M', 2), ('coach-jacket-black', 'L', 1),
  ('quilted-vest-navy', 'S', 1), ('quilted-vest-navy', 'M', 1), ('quilted-vest-navy', 'L', 2), ('quilted-vest-navy', 'XL', 1),
  ('kids-graphic-tee-yellow', 'XS', 4), ('kids-graphic-tee-yellow', 'S', 3),
  ('canvas-tote-natural', 'OS', 10),
  ('dad-cap-washed-blue', 'OS', 2)
) as v (slug, size, stock)
join public.products p on p.slug = v.slug;
