// Client-side manager for anonymous peer ratings
document.addEventListener('DOMContentLoaded', () => {
    const ratingsState = {
        periodId: null,
        voterId: null,
        colleagues: [], // list of colleague IDs to rate
        ratings: {},    // { colleagueId: { kpiId: score|null } }
        activeColleagueId: null
    };

    // Load setup data from DOM attributes
    const ratingContainer = document.getElementById('rating-container');
    if (!ratingContainer) return; // Not on the rating page

    ratingsState.periodId = parseInt(ratingContainer.dataset.periodId, 10);
    ratingsState.voterId = parseInt(ratingContainer.dataset.voterId, 10);

    // Initialize list of colleagues from the sidebar elements
    const colleagueItems = document.querySelectorAll('.colleague-item');
    colleagueItems.forEach(item => {
        const id = parseInt(item.dataset.id, 10);
        ratingsState.colleagues.push(id);
        ratingsState.ratings[id] = {};
    });

    // Storage key unique to this voter and period
    const storageKey = `appraisal_ratings_${ratingsState.periodId}_${ratingsState.voterId}`;

    // Load existing ratings from localStorage if present
    const savedRatings = localStorage.getItem(storageKey);
    if (savedRatings) {
        try {
            const parsed = JSON.parse(savedRatings);
            // Merge into ratingsState.ratings
            Object.keys(parsed).forEach(cid => {
                const colleagueId = parseInt(cid, 10);
                if (ratingsState.ratings[colleagueId]) {
                    Object.keys(parsed[cid]).forEach(kid => {
                        const kpiId = parseInt(kid, 10);
                        ratingsState.ratings[colleagueId][kpiId] = parsed[cid][kid];
                    });
                }
            });
        } catch (e) {
            console.error("Error parsing saved ratings from localStorage", e);
        }
    }

    // Set active colleague
    if (ratingsState.colleagues.length > 0) {
        setActiveColleague(ratingsState.colleagues[0]);
    }

    // Event listener for sidebar colleague selection
    colleagueItems.forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.dataset.id, 10);
            saveActiveRatings();
            setActiveColleague(id);
        });
    });

    // Handle "Save & Next" button
    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            saveActiveRatings();
            const currentIndex = ratingsState.colleagues.indexOf(ratingsState.activeColleagueId);
            if (currentIndex !== -1 && currentIndex < ratingsState.colleagues.length - 1) {
                setActiveColleague(ratingsState.colleagues[currentIndex + 1]);
            } else {
                showToast("You have reached the end of the list. Please verify your ratings and submit.");
            }
        });
    }

    // Handle "Back" button
    const prevBtn = document.getElementById('btn-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            saveActiveRatings();
            const currentIndex = ratingsState.colleagues.indexOf(ratingsState.activeColleagueId);
            if (currentIndex > 0) {
                setActiveColleague(ratingsState.colleagues[currentIndex - 1]);
            }
        });
    }

    // Handle "Submit Appraisal" button
    const submitBtn = document.getElementById('btn-submit-appraisal');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            saveActiveRatings();
            
            // Validate all colleagues are fully rated
            const unratedColleagues = getUnratedColleagues();
            if (unratedColleagues.length > 0) {
                const confirmSubmit = confirm(`You have not rated ${unratedColleagues.length} of your colleagues. Do you still want to submit? Unrated colleagues/KPIs will be saved as N/A.`);
                if (!confirmSubmit) {
                    setActiveColleague(unratedColleagues[0]);
                    return;
                }
            } else {
                const confirmSubmit = confirm("Are you sure you want to submit your appraisal? Once submitted, it cannot be changed.");
                if (!confirmSubmit) return;
            }

            submitAppraisal();
        });
    }

    // Set UI state for the selected colleague
    function setActiveColleague(id) {
        ratingsState.activeColleagueId = id;

        // Highlight in sidebar
        colleagueItems.forEach(item => {
            if (parseInt(item.dataset.id, 10) === id) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update card headers
        const activeNameEl = document.getElementById('active-colleague-name');
        if (activeNameEl) {
            const selectedItem = document.querySelector(`.colleague-item[data-id="${id}"]`);
            activeNameEl.textContent = selectedItem ? selectedItem.dataset.name : "Colleague";
        }

        // Reset all radio buttons / checkboxes in the DOM
        const form = document.getElementById('ratings-form');
        if (form) {
            form.reset();
        }

        // Populate saved values
        const currentRatings = ratingsState.ratings[id] || {};
        const kpiRows = document.querySelectorAll('.kpi-row');
        kpiRows.forEach(row => {
            const kpiId = parseInt(row.dataset.kpiId, 10);
            const savedValue = currentRatings[kpiId];

            if (savedValue === null) {
                // It was marked N/A
                const naCheck = row.querySelector('.na-checkbox');
                if (naCheck) naCheck.checked = true;
                disableKpiRadios(row, true);
            } else if (savedValue !== undefined) {
                // Radio value selected
                const radio = row.querySelector(`input[type="radio"][value="${savedValue}"]`);
                if (radio) radio.checked = true;
            }
        });

        // Set N/A checkboxes listener
        const naCheckboxes = document.querySelectorAll('.na-checkbox');
        naCheckboxes.forEach(checkbox => {
            checkbox.onchange = (e) => {
                const row = e.target.closest('.kpi-row');
                disableKpiRadios(row, e.target.checked);
            };
        });

        // Update Prev/Next button states
        const currentIndex = ratingsState.colleagues.indexOf(id);
        if (prevBtn) prevBtn.disabled = (currentIndex === 0);
        if (nextBtn) {
            if (currentIndex === ratingsState.colleagues.length - 1) {
                nextBtn.textContent = "Finish Rating";
            } else {
                nextBtn.textContent = "Save & Next";
            }
        }

        // Focus card header for accessibility
        activeNameEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Save inputs from active card into memory & localStorage
    function saveActiveRatings() {
        const id = ratingsState.activeColleagueId;
        if (!id) return;

        const currentRatings = {};
        const kpiRows = document.querySelectorAll('.kpi-row');
        
        kpiRows.forEach(row => {
            const kpiId = parseInt(row.dataset.kpiId, 10);
            const naCheck = row.querySelector('.na-checkbox');

            if (naCheck && naCheck.checked) {
                currentRatings[kpiId] = null; // Marked as N/A
            } else {
                const checkedRadio = row.querySelector('input[type="radio"]:checked');
                if (checkedRadio) {
                    currentRatings[kpiId] = parseInt(checkedRadio.value, 10);
                } else {
                    // Not rated yet
                }
            }
        });

        ratingsState.ratings[id] = currentRatings;

        // Persist to localStorage
        localStorage.setItem(storageKey, JSON.stringify(ratingsState.ratings));

        // Update sidebar item visual status
        updateSidebarStatus(id);
        checkGlobalCompletion();
    }

    function disableKpiRadios(row, disabled) {
        const radios = row.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            radio.disabled = disabled;
            if (disabled) radio.checked = false;
        });
    }

    function updateSidebarStatus(id) {
        const item = document.querySelector(`.colleague-item[data-id="${id}"]`);
        if (!item) return;

        const isRated = isColleagueFullyRated(id);
        const badge = item.querySelector('.status-badge');
        
        if (badge) {
            if (isRated) {
                badge.textContent = 'Completed';
                badge.className = 'status-badge status-completed';
            } else {
                badge.textContent = 'Pending';
                badge.className = 'status-badge status-pending';
            }
        }
    }

    function isColleagueFullyRated(id) {
        const currentRatings = ratingsState.ratings[id];
        if (!currentRatings) return false;

        const kpiCount = document.querySelectorAll('.kpi-row').length;
        let ratedCount = 0;

        Object.keys(currentRatings).forEach(kpiId => {
            if (currentRatings[kpiId] !== undefined) {
                ratedCount++;
            }
        });

        return ratedCount === kpiCount;
    }

    function getUnratedColleagues() {
        return ratingsState.colleagues.filter(id => !isColleagueFullyRated(id));
    }

    function checkGlobalCompletion() {
        const unrated = getUnratedColleagues();
        const progressCountEl = document.getElementById('progress-count');
        if (progressCountEl) {
            const completedCount = ratingsState.colleagues.length - unrated.length;
            progressCountEl.textContent = `${completedCount}/${ratingsState.colleagues.length}`;
        }
    }

    // Submit payload to server
    function submitAppraisal() {
        // Construct the bulk payload
        const payload = {
            period_id: ratingsState.periodId,
            voter_id: ratingsState.voterId,
            colleagues: []
        };

        ratingsState.colleagues.forEach(cid => {
            const colleagueScores = ratingsState.ratings[cid] || {};
            const scoresArray = [];

            // Find all KPI IDs from the document
            const kpiRows = document.querySelectorAll('.kpi-row');
            kpiRows.forEach(row => {
                const kpiId = parseInt(row.dataset.kpiId, 10);
                const val = colleagueScores[kpiId];
                scoresArray.push({
                    kpi_id: kpiId,
                    score: val === undefined ? null : val // treat missing as N/A (null)
                });
            });

            payload.colleagues.push({
                employee_id: cid,
                scores: scoresArray
            });
        });

        // Submit via fetch
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        fetch('/reviewer/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.message || 'Submission failed'); });
            }
            return response.json();
        })
        .then(data => {
            // Success! Clear local storage
            localStorage.removeItem(storageKey);
            showToast("Appraisal submitted successfully!", true);
            setTimeout(() => {
                window.location.href = '/reviewer/success';
            }, 1500);
        })
        .catch(err => {
            console.error(err);
            alert("Error submitting appraisal: " + err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Appraisal';
        });
    }

    // Initial sidebar status pass & count
    ratingsState.colleagues.forEach(id => {
        updateSidebarStatus(id);
    });
    checkGlobalCompletion();

    // Helper: Toast display
    function showToast(message, isSuccess = false) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        if (isSuccess) {
            toast.style.borderLeftColor = 'var(--accent-emerald)';
        } else {
            toast.style.borderLeftColor = '#f59e0b';
        }
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});
