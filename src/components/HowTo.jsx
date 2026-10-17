import React from 'react'

export default function HowTo({ compact }) {
  return (
    <details className="howto" open={!compact}>
      <summary>How to play</summary>
      <ol>
        <li>The host fills the jar with words. One word is pulled out each game.</li>
        <li>Everyone sees the word, except the Dhongi, who only sees “You are the Dhongi”.</li>
        <li>Take turns typing one clue that’s related to the word. Too obvious and the Dhongi learns it. Too vague and you look suspicious.</li>
        <li>The Dhongi has to fake it, using everyone else’s clues.</li>
        <li>After the last round, vote. Catch the Dhongi and the innocents win. A tie, or the wrong person, and the Dhongi escapes.</li>
      </ol>
    </details>
  )
}
