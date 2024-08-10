//@ts-ignore
import logo from './logo.svg';
import './App.css';
import { useEffect } from 'react';
import axios from 'axios';
import OpenAI from 'openai';

import { getEmbedding as originGetEmbedding, EmbeddingIndex, SearchResult } from './VectorSearch/VectorSearch';
import React from 'react';

function App() {

	const [query, setQuery] = React.useState('');
	const [page_ids, setPageIds] = React.useState('2be24753722945c897620fe4ef8663c3');

	const getAccessToken = () => {
		const urlParams = new URLSearchParams(window.location.search);
		const code = urlParams.get('code');
		if (code) {
			// Exchange code for access token
			exchangeCodeForToken(code);
		}
	};


	const exchangeCodeForToken = async (code: string) => {

		axios.post('http://localhost:3001/access.token', {
			code
		})
			.then(response => {
				console.log('Response from server:', response.data);
				if (response.data.access_token) {
					localStorage.setItem('access_token', response.data.access_token);
					window.location.href = `${process.env.REACT_APP_REDIRECT_URI}`;
				}
				window.location.href = `${process.env.REACT_APP_REDIRECT_URI}`;
			})
			.catch(error => {
				console.error('Error:', error);
			});
	};


	const getPages = async () => {
		axios.post('http://localhost:3001/get.pages', {
			access_token: localStorage.getItem('access_token'),
			page_ids
		})
			.then(response => {
				console.log('Response from server:', response.data);
				if (response.data.pages) {
					localStorage.setItem('pages', JSON.stringify(response.data.pages));
				}

			})
			.catch(error => {
				console.error('Error:', error);
			});
	}


	const authorize = () => {
		window.location.href = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${process.env.REACT_APP_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REACT_APP_REDIRECT_URI as string)}&response_type=code`;
	};


	const getInsignts = async() => {

		console.log(process.env.REACT_APP_OPENAI_KEY,)
		const openai = new OpenAI({
			apiKey: process.env.REACT_APP_OPENAI_KEY,
			dangerouslyAllowBrowser: true
		});

		const pages = localStorage.getItem('pages');
		
		const chatCompletion = await openai.embeddings.create({
			model: 'text-embedding-3-large',
			input: ['A happy moment', 'I am sad.'],
		});

		console.log(chatCompletion);
	};


	const getEmbedding = async(text: string) => {
		return originGetEmbedding(text, 7, undefined, 'Xenova/gte-small');
	}

	const loadPages = async() => {

		//@ts-ignore
		let pages = localStorage.getItem('pages') ? JSON.parse(localStorage.getItem('pages')) : [];
		console.log('pages', pages);

		let data: any[] = [];

		for (let i = 0; i < pages.length; i++) {
			let e = pages[i];
			console.log('eeee', e);
			e.embedding = await getEmbedding(e.content);

			console.log('eaaa', e);

			data.push(e);
		}

		
		console.log('res', data);
		const index = new EmbeddingIndex(data); // Creates an ind

		const index_pages = await index.getAllObjectsFromIndexedDB();
		console.log('index_pages', index_pages);

		// specify the storage type
		await index.saveIndex('indexedDB');
	}

	const getResult = async(): Promise<SearchResult[]> => {
		
		const index = new EmbeddingIndex();

		const query_embedding = await getEmbedding(query);
		const result = await index.search(query_embedding, {
			topK: 5,
			useStorage: 'indexedDB',
		});
		console.log('result', result);
		return result;
	}


	const getHumanResults = async() => {

		const results = await getResult();

		const openai = new OpenAI({
			apiKey: process.env.REACT_APP_OPENAI_KEY,
			dangerouslyAllowBrowser: true
		});


		/**
		 * Use the below article on the 2022 Winter Olympics to answer the subsequent question. If the answer cannot be found, write "I don't know."

Article:
\"\"\"
{wikipedia_article_on_curling}
\"\"\"

Question: Which athletes won the gold medal in curling at the 2022 Winter Olympics?"
		 */
		const completion = await openai.chat.completions.create({
			messages: [{ role: "system", content: "You are a helpful assistant." },
			{ role: "user", content: `Use the below information below  to answer the subsequent question. If the answer cannot be found, write "I don't know."
			
			Article:
			"""
			${
				//@ts-ignore
				results.filter(e => e.similarity >= 0.8).map(e => e.object.content).join('\n')}
			"""
			Question: ${query}
			
			`}
		],
			model: "gpt-4o-mini",
		});


		
		console.log(completion);
	}

	return (
		<div className="App">
			<header className="App-header">
				<img src={logo} className="App-logo" alt="logo" />
				<p>
					Edit <code>src/App.js</code> and save to reload.
				</p>
				<a
					className="App-link"
					href="https://reactjs.org"
					target="_blank"
					rel="noopener noreferrer"
				>
					Learn React
				</a>
				<button onClick={getAccessToken}>Get access token</button>
				<button onClick={authorize}>Login notion</button>


				<textarea value={page_ids} onChange={(e) => setPageIds(e.target.value)}></textarea>
				<button onClick={getPages}>Get Pages</button>
		

				<button onClick={loadPages}>Get Pages In Storages</button>

				<textarea value={query} onChange={(e) => setQuery(e.target.value)}></textarea>

				<button onClick={getResult}>Get result</button>
				<button onClick={getHumanResults}>Get Human result</button>
			</header>
		</div>
	);
}

export default App;
