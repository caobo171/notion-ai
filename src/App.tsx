//@ts-ignore
import logo from './logo.svg';
import './App.css';
import { useEffect } from 'react';
import axios from 'axios';
import OpenAI from 'openai';

import { getEmbedding as originGetEmbedding, EmbeddingIndex } from 'client-vector-search';
import { pipeline, env } from "@xenova/transformers";

// Disable local models
env.allowLocalModels = false;
function App() {

	// const openai = axios.create({
	// 	baseURL: 'https://api.openai.com/v1',
	// 	headers: {
	// 		'Content-Type': 'application/json',
	// 		'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_KEY}`,
	// 	},
	// });

	// const getOpenAIResponse = async (prompt: any) => {
	// 	const response = await openai.post('/completions', {
	// 		model: 'text-davinci-003',
	// 		prompt: prompt,
	// 		max_tokens: 100,
	// 	});
	// 	return response.data;
	// };

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
			page_id: '2be24753722945c897620fe4ef8663c3'
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
		const pages = localStorage.getItem('pages');

		let res =  [
			{ id: 2, name: "Banana", embedding: await getEmbedding("Banana") },
			{ id: 3, name: "Cheddar", embedding: await getEmbedding("Cheddar")},
			{ id: 4, name: "Space", embedding: await getEmbedding("Space")},
			{ id: 5, name: "database", embedding: await getEmbedding("database")},
		];

		let data: any[] = [];
		// res.map(async (e: any) => {
		// 	if (!e.embedding){
		// 		e.embedding = await getEmbedding(e.content);
		// 	}

		// 	data.push(e);
		// })
		
		console.log('res', data);
		const index = new EmbeddingIndex(data); // Creates an ind

		const index_pages = await index.getAllObjectsFromIndexedDB();
		console.log('index_pages', index_pages);

		// specify the storage type
		await index.saveIndex('indexedDB');
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

				<button onClick={getPages}>Get Pages</button>
				<button onClick={getInsignts}>Get Insights</button>

				<button onClick={loadPages}>Get Pages In Storages</button>
			</header>
		</div>
	);
}

export default App;
