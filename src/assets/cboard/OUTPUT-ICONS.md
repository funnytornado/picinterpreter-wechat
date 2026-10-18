# CBoard output icons

The three `output-*.svg` files reuse the exact paths of CBoard's installed
`@material-ui/icons` Backspace, Undo and Clear components. SVG wrappers let Taro
render the same icons without importing React DOM / Material UI into WeChat.
The upstream MIT notice is preserved in `material-ui-icons-LICENSE.txt`.

The existing patient action button provides the large touch target and label.
Neutral grey (#616161) follows CBoard output controls; no pictogram or photo is
recoloured. Disabled controls use the existing button opacity.
