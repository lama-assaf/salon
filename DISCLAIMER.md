# disclaimer

read this before you connect salon to a real X, LinkedIn, Discord, Telegram, or Reddit account.

## experimental status

salon is an experimental Claude Code plugin. skills, agents, and MCP templates in this repo have not been battle-tested across every account type, platform edge case, or API version. behavior can change between releases, and a skill that worked well on one project may need adjustment on another. treat every output as a draft, not a finished decision.

## do your own research

before you wire up any MCP server, read `mcp-configs/README.md` and the catalog entry for that server. it lists cost, auth requirements, and known risk flags where they exist. that list reflects a point-in-time research pass and can go stale — API terms, pricing, and vendor policies change on their own schedule, not salon's. confirm current terms directly with the vendor or platform before you rely on a flag being accurate.

## no warranty

salon is provided as-is, under the MIT license in `LICENSE`, with no warranty of any kind, express or implied. that includes no warranty that drafted content is accurate, on-brand, compliant with any platform's rules, or safe to publish without review.

## the operator owns the output

nothing in salon publishes on its own. every post, reply, comment, or broadcast a skill drafts is reviewed and sent by the person or team running it. that means the operator — not salon, not the skill, not the plugin's authors — owns every piece of content that goes out, and is responsible for its accuracy, tone, and consequences.

## platform terms of service are your responsibility

using an MCP server against a platform's API, official or unofficial, means agreeing to and following that platform's terms. salon documents risk where it knows about it, but it doesn't make the compliance decision for you. two templates carry specific flags worth repeating here:

- **linkedin-unofficial** connects through an unofficial scraper, not LinkedIn's own API. this is flagged as a ToS risk in the MCP catalog and requires explicit confirmation before `/salon:mcp-setup` will add it. adding it anyway is a decision the operator makes with full knowledge of that risk, not a default salon recommends.
- **telegram** (the MTProto template) automates a real user session, not a bot account, and requires a one-time interactive login before first use. automating a user account carries its own terms-of-service considerations separate from bot-account automation. the operator decides whether that tradeoff is acceptable for their account.

for every other server in the catalog, check the vendor's current terms, rate limits, and acceptable-use policy before connecting it to a project.

## engagement ethics are binding, not optional

`rules/social/engagement-ethics.md` sets default behavior for how salon's engagement and comment skills operate — things like not impersonating other accounts, not manufacturing fake engagement, and not misrepresenting who's behind a reply. these are defaults the skills follow, not suggestions the operator can silently skip by asking nicely. if a use case requires stepping outside them, that's a deliberate operator decision made with eyes open, and the operator carries responsibility for it.

## not legal or financial advice

nothing salon produces is legal, financial, or compliance advice. this applies with particular force to any web3, token, or crowdfunding-adjacent language that appears in example prompts, templates, or sample output across the skills and commands — those are writing illustrations, not guidance on what's compliant to say publicly about a token, security, or investment. run anything in that territory past qualified legal counsel before it goes out under your name.

## no affiliation

salon is an independent, community-built plugin. it is not affiliated with, endorsed by, or sponsored by X, LinkedIn, Discord, Telegram, Reddit, Hacker News, Brave Search, Postiz, Typefully, Buffer, or any other platform or vendor its MCP templates connect to. all trademarks belong to their respective owners.
