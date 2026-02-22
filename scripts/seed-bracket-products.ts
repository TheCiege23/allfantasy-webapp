import { getUncachableStripeClient } from '../lib/stripe-client'

async function seedBracketProducts() {
  const stripe = await getUncachableStripeClient()

  const existing = await stripe.products.search({
    query: "metadata['app']:'fancred_brackets'",
  })

  if (existing.data.length > 0) {
    console.log('Bracket products already exist:')
    for (const p of existing.data) {
      console.log(`  - ${p.name} (${p.id})`)
    }
    return
  }

  const firstBracketProduct = await stripe.products.create({
    name: 'Bracket Hosting Fee',
    description: 'One-time $2 hosting convenience fee to create your first bracket in a paid league.',
    metadata: {
      app: 'fancred_brackets',
      type: 'first_bracket_fee',
    },
  })

  await stripe.prices.create({
    product: firstBracketProduct.id,
    unit_amount: 200,
    currency: 'usd',
    metadata: {
      app: 'fancred_brackets',
      type: 'first_bracket_fee',
    },
  })

  console.log(`Created: ${firstBracketProduct.name} ($2) - ${firstBracketProduct.id}`)

  const unlimitedProduct = await stripe.products.create({
    name: 'Unlimited Brackets Unlock',
    description: 'One-time $3 upgrade to unlock unlimited brackets for a paid league tournament.',
    metadata: {
      app: 'fancred_brackets',
      type: 'unlimited_unlock',
    },
  })

  await stripe.prices.create({
    product: unlimitedProduct.id,
    unit_amount: 300,
    currency: 'usd',
    metadata: {
      app: 'fancred_brackets',
      type: 'unlimited_unlock',
    },
  })

  console.log(`Created: ${unlimitedProduct.name} ($3) - ${unlimitedProduct.id}`)
  console.log('Done seeding bracket products.')
}

seedBracketProducts().catch(console.error)
