require('dotenv').config(); // Load .env file

// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { Client, iteratePaginatedAPI } = require('@notionhq/client');

const app = express();
const port = 3001;
var cors = require('cors')

app.use(cors())

// Middleware to parse JSON data
app.use(bodyParser.json());

// Route to handle POST requests
app.post('/data', (req, res) => {
	const data = req.body;

	console.log('Received data:', data);

	// Respond with a success message
	res.status(200).json({ message: 'Data received successfully', receivedData: data });
});



app.post('/access.token', async (req, res) => {

	const data = req.body;
	// encode in base 64
	const encoded = Buffer.from(`${process.env.REACT_APP_CLIENT_ID}:${process.env.REACT_APP_NOTION_SECRET}`).toString("base64");

	const response = await fetch("https://api.notion.com/v1/oauth/token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			Authorization: `Basic ${encoded}`,
		},
		body: JSON.stringify({
			grant_type: "authorization_code",
			code: data.code,
			redirect_uri: process.env.REACT_APP_REDIRECT_URI
		}),
	}).then(e => e.json());

	console.log('response', response);
	console.log(`${process.env.REACT_APP_CLIENT_ID}:${process.env.REACT_APP_REDIRECT_URI}`)


	res.status(200).json({ access_token: response.access_token });
});


app.post('/get.pages', async (req, res) => {

	const notion = new Client({ auth: req.body.access_token });

	const page_ids = req.body.page_ids.split(',').filter(e => e);
	

	let pages = [];
	for (let i = 0; i < page_ids.length; i++) {
		const new_pages = await getAllPagesAndSubpages(page_ids[i], notion);
		pages = [...pages, ...new_pages];
	}

	console.log('pages', pages);
	res.status(200).json({ pages});
});


// Start the server
app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});




// Take rich text array from a block child that supports rich text and return the plain text.
// Note: All rich text objects include a plain_text field.
const getPlainTextFromRichText = richText => {
	return richText.map(t => t.plain_text).join("")
	// Note: A page mention will return "Undefined" as the page name if the page has not been shared with the integration. See: https://developers.notion.com/reference/block#mention
}

// Use the source URL and optional caption from media blocks (file, video, etc.)
const getMediaSourceText = block => {
	let source, caption

	if (block[block.type].external) {
		source = block[block.type].external.url
	} else if (block[block.type].file) {
		source = block[block.type].file.url
	} else if (block[block.type].url) {
		source = block[block.type].url
	} else {
		source = "[Missing case for media block types]: " + block.type
	}
	// If there's a caption, return it with the source
	if (block[block.type].caption.length) {
		caption = getPlainTextFromRichText(block[block.type].caption)
		return caption + ": " + source
	}
	// If no caption, just return the source URL
	return source
}

// Get the plain text from any block type supported by the public API.
const getTextFromBlock = block => {
	let text

	// Get rich text from blocks that support it
	if (block[block.type].rich_text) {
		// This will be an empty string if it's an empty line.
		text = getPlainTextFromRichText(block[block.type].rich_text)
	}
	// Get text for block types that don't have rich text
	else {
		switch (block.type) {
			// case "unsupported":
			// 	// The public API does not support all block types yet
			// 	text = "[Unsupported block type]"
			// 	break
			// case "bookmark":
			// 	text = block.bookmark.url
			// 	break
			// case "child_database":
			// 	text = block.child_database.title
			// 	// Use "Query a database" endpoint to get db rows: https://developers.notion.com/reference/post-database-query
			// 	// Use "Retrieve a database" endpoint to get additional properties: https://developers.notion.com/reference/retrieve-a-database
			// 	break
			case "child_page":
				text = block.child_page.title
				break
			case "equation":
				text = block.equation.expression
				break
			default:
				text = ""
				break
		}
	}
	// Blocks with the has_children property will require fetching the child blocks. (Not included in this example.)
	// e.g. nested bulleted lists
	// if (block.has_children) {
	// 	// For now, we'll just flag there are children blocks.
	// 	text = text + " (Has children)"
	// }
	// Includes block type for readability. Update formatting as needed.
	return text
}

async function retrieveBlockChildren(id, notion) {
	console.log("Retrieving blocks (async)...")
	const blocks = []

	// Use iteratePaginatedAPI helper function to get all blocks first-level blocks on the page
	for await (const block of iteratePaginatedAPI(notion.blocks.children.list, {
		block_id: id, // A page ID can be passed as a block ID: https://developers.notion.com/docs/working-with-page-content#modeling-content-as-blocks
	})) {
		blocks.push(block)
	}

	return blocks
}

const getBlockText = (blocks, notion) => {
	console.log("Displaying blocks:")

	let res = ''
	for (let i = 0; i < blocks.length; i++) {
		 text = getTextFromBlock(blocks[i], notion)
		// Print plain text for each block.
		res = res + "\n" + text;
	}

	console.log(res);
	return res;
}



async function getAllPagesAndSubpages(pageId, notion) {
	const pages = [];
	const traversePage = async (id, notion) => {
		const blocks = await retrieveBlockChildren(id, notion);

		pages.push({
			id: id,
			content: getBlockText(blocks, notion)
		});
		for (const block of blocks) {
			if (block.type === 'child_page') {
				await traversePage(block.id, notion); // Recursively fetch subpages
			} 
			
			// else if (block.type === 'link_to_page') {
			// 	pages.push({
			// 		id: block.id,
			// 		title: block.link_to_page.page_id,
			// 	});
			// 	await traversePage(block.link_to_page.page_id); // Recursively fetch subpages
			// }
		}
	};
	await traversePage(pageId, notion);
	return pages;
}
