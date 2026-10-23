document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('loadBtn');
    const personIdInput = document.getElementById('personId');
    const profileDiv = document.getElementById('profile');

    async function fetchPerson(id) {
        profileDiv.innerHTML = '<p>Loading...</p>';

        try {
            const response = await fetch(`api/get_person.php?id=${id}`);
            const result = await response.json();

            if (result.success) {
                renderProfile(result.data);
            } else {
                profileDiv.innerHTML = `<p style="color: red;">Error: ${result.error}</p>`;
            }
        } catch (err) {
            profileDiv.innerHTML = `<p style="color: red;">Failed to fetch data from API.</p>`;
            console.error(err);
        }
    }

    function renderProfile(person) {
        const name = [person.prefix, person.first_name, person.last_name, person.suffix]
            .filter(Boolean)
            .join(' ');

        profileDiv.innerHTML = `
            <h2>${name} ${person.nickname ? `("${person.nickname}")` : ''}</h2>
            <div class="field"><span class="label">ID:</span> ${person.id}</div>
            <div class="field"><span class="label">Family Lineage Code:</span> ${person.family_id || 'N/A'}</div>
            <div class="field"><span class="label">Sex:</span> ${person.sex || 'N/A'}</div>
            <div class="field"><span class="label">Birth:</span> ${person.birth_date || 'Unknown'} ${person.birth_place ? `(${person.birth_place})` : ''}</div>
            <div class="field"><span class="label">Death:</span> ${person.death_date || 'N/A'} ${person.death_place ? `(${person.death_place})` : ''}</div>
        `;
    }

    // Initial load for default ID
    fetchPerson(personIdInput.value);

    // Load on button click
    loadBtn.addEventListener('click', () => {
        fetchPerson(personIdInput.value);
    });
});
