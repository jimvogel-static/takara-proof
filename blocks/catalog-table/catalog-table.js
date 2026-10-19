// Takara proof: catalog-number table for a configurable product (one row per catalog number).
import { addProductsToCart } from '@dropins/storefront-cart/api.js';
import { CS_FETCH_GRAPHQL, getProductSku } from '../../scripts/commerce.js';

const QUERY = `query V($sku: String!) { variants(sku: $sku) { variants { selections
  product { sku name inStock ... on SimpleProductView { price { final { amount { value currency } } } } } } } }`;

const money = (a) => (a && a.value != null
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: a.currency && a.currency !== 'NONE' ? a.currency : 'USD' }).format(a.value)
  : '');

export default async function decorate(block) {
  const sku = getProductSku();
  block.textContent = '';
  if (!sku) return;
  const { data } = await CS_FETCH_GRAPHQL.fetchGraphQl(QUERY, { variables: { sku } });
  const rows = data?.variants?.variants || [];
  if (!rows.length) { block.remove(); return; }
  rows.sort((a, b) => (a.product.price?.final?.amount?.value || 0) - (b.product.price?.final?.amount?.value || 0));
  const table = document.createElement('table');
  table.innerHTML = '<caption>Order by catalog number</caption><thead><tr><th scope="col">Cat. #</th><th scope="col">Size</th><th scope="col">Price</th><th scope="col">Availability</th><th scope="col">Qty</th></tr></thead><tbody></tbody>';
  const tbody = table.querySelector('tbody');
  rows.forEach(({ selections, product }, i) => {
    const tr = document.createElement('tr');
    const size = product.name.split(',').pop().trim();
    tr.innerHTML = `<th scope="row">${product.sku}</th><td>${size}</td><td>${money(product.price?.final?.amount)}</td>
      <td>${product.inStock ? 'In stock' : 'Out of stock'}</td>
      <td><label class="visually-hidden" for="ct-q-${i}">Quantity for ${product.sku}</label>
      <input id="ct-q-${i}" type="number" min="0" step="1" value="0" inputmode="numeric" ${product.inStock ? '' : 'disabled'}></td>`;
    tr.dataset.uid = selections[0];
    tbody.append(tr);
  });
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'button';
  btn.textContent = 'Add selected to cart';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  btn.addEventListener('click', async () => {
    const items = [...tbody.rows]
      .map((tr) => ({ sku, quantity: Number(tr.querySelector('input').value), optionsUIDs: [tr.dataset.uid] }))
      .filter((it) => it.quantity > 0);
    if (!items.length) { status.textContent = 'Enter a quantity for at least one catalog number.'; return; }
    btn.disabled = true;
    try {
      await addProductsToCart(items);
      status.textContent = `Added ${items.reduce((n, it) => n + it.quantity, 0)} item(s) to cart.`;
      tbody.querySelectorAll('input').forEach((inp) => { inp.value = 0; });
    } catch (e) {
      status.textContent = `Could not add to cart: ${e.message}`;
    } finally { btn.disabled = false; }
  });
  block.append(table, btn, status);
}
